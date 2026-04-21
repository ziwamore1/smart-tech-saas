import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TimetableSolverService } from './timetable-solver.service';
import { TimetableGateway } from '../timetable.gateway';

export interface TimetableGenerationJob {
  schoolId: string;
  termId: string;
  classIds?: string[];
  requestedBy: string;
}

export interface JobProgress {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class TimetableQueueService {
  private progressMap: Map<string, JobProgress> = new Map();
  private processingJobs = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private solver: TimetableSolverService,
    private timetableGateway: TimetableGateway,
  ) {}

  async addGenerationJob(data: TimetableGenerationJob): Promise<string> {
    const jobId = `timetable-${data.schoolId}-${Date.now()}`;

    this.progressMap.set(jobId, {
      jobId,
      status: 'queued',
      progress: 0,
      message: 'Job queued, starting...',
    });

    this.timetableGateway.broadcastToSchool(data.schoolId, {
      type: 'timetableGenerationStarted',
      jobId,
      message: 'Your timetable generation job has been queued',
    });

    setImmediate(() => {
      this.processTimetableGeneration(jobId, data);
    });

    return jobId;
  }

  private async processTimetableGeneration(
    jobId: string,
    data: TimetableGenerationJob,
  ): Promise<void> {
    const startTime = Date.now();

    this.updateProgress(jobId, {
      jobId,
      status: 'running',
      progress: 0,
      message: 'Building schedule context...',
      startedAt: new Date(),
    });

    try {
      const context = await this.solver.buildScheduleContext(
        data.schoolId,
        data.termId,
        data.classIds,
      );

      if (context.lessonRequirements.length === 0) {
        throw new Error(
          'No lesson requirements found. Please add lesson requirements before generating the timetable.',
        );
      }

      const solutions = await this.solver.solve(
        context,
        {
          maxIterations: 2000,
          populationSize: 100,
          maxTime: 120000,
        },
        (progress, message) => {
          this.updateProgress(jobId, {
            jobId,
            status: 'running',
            progress,
            message,
          });

          this.timetableGateway.broadcastToSchool(data.schoolId, {
            type: 'timetableGenerationProgress',
            jobId,
            progress,
            message,
          });
        },
      );

      const classSolutions = this.solver.generateSolutionsByClass(solutions);

      await this.prisma.$transaction(async (tx) => {
        for (const classSol of classSolutions) {
          const existing = await tx.timetable.findFirst({
            where: {
              classId: classSol.classId,
              termId: data.termId,
            },
          });

          if (existing) {
            await tx.timetableSlot.deleteMany({
              where: { timetableId: existing.id },
            });
            await tx.timetable.delete({
              where: { id: existing.id },
            });
          }

          const timetable = await tx.timetable.create({
            data: {
              schoolId: data.schoolId,
              termId: data.termId,
              classId: classSol.classId,
            },
          });

          if (classSol.lessons.length > 0) {
            await tx.timetableSlot.createMany({
              data: classSol.lessons.map((l) => ({
                timetableId: timetable.id,
                day: l.day,
                period: l.period,
                subjectId: l.subjectId,
                teacherId: l.teacherId,
                classroomId: l.classroomId,
              })),
            });
          }
        }
      });

      const duration = Date.now() - startTime;

      this.updateProgress(jobId, {
        jobId,
        status: 'completed',
        progress: 100,
        message: `Timetable generated successfully in ${(duration / 1000).toFixed(1)}s`,
        completedAt: new Date(),
        result: {
          classesGenerated: classSolutions.length,
          totalLessons: classSolutions.reduce(
            (sum, cs) => sum + cs.lessons.length,
            0,
          ),
          score: solutions.score,
          violations: solutions.violations.length,
        },
      });

      this.timetableGateway.broadcastToSchool(data.schoolId, {
        type: 'timetableGenerationCompleted',
        jobId,
        message: 'Timetable generated successfully!',
        result: {
          classesGenerated: classSolutions.length,
          duration: `${(duration / 1000).toFixed(1)}s`,
        },
      });
    } catch (error: any) {
      console.error('Timetable generation failed:', error);

      this.updateProgress(jobId, {
        jobId,
        status: 'failed',
        progress: 0,
        message: 'Generation failed',
        error: error.message,
        completedAt: new Date(),
      });

      this.timetableGateway.broadcastToSchool(data.schoolId, {
        type: 'timetableGenerationFailed',
        jobId,
        message: error.message || 'Timetable generation failed',
      });
    }
  }

  private updateProgress(jobId: string, progress: JobProgress): void {
    this.progressMap.set(jobId, progress);
  }

  getProgress(jobId: string): JobProgress | undefined {
    return this.progressMap.get(jobId);
  }

  getSchoolProgress(schoolId: string): JobProgress[] {
    return Array.from(this.progressMap.values()).filter((p) =>
      p.jobId.includes(schoolId),
    );
  }
}
