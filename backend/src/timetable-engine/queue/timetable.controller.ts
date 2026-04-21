import { Controller, Post, Get, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { 
  createJob, 
  createHighPriorityJob, 
  getJobStatus, 
  TimetableJobData,
  TimetableJobResult 
} from './queue';
import { HybridConfig, PenaltyWeights } from '../solver/fastHybridSolver';
import { Lesson } from '../solver/fastCSPSolver';
import { SlotIndex } from '../entities/cache';

class GenerateTimetableDto {
  lessons: Lesson[];
  slots: SlotIndex[];
  config?: Partial<HybridConfig>;
  weights?: PenaltyWeights;
  priority?: boolean;
  schoolId?: string;
  userId?: string;
}

class JobResponse {
  jobId: string;
  status: string;
}

class JobStatusResponse {
  jobId: string;
  state: string;
  result?: TimetableJobResult;
  progress?: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
  createdOn?: number;
}

@Controller('timetable')
export class TimetableQueueController {
  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateTimetable(
    @Body() dto: GenerateTimetableDto
  ): Promise<JobResponse> {
    const jobData: TimetableJobData = {
      lessons: dto.lessons,
      slots: dto.slots,
      config: dto.config,
      weights: dto.weights,
      schoolId: dto.schoolId,
      userId: dto.userId,
    };

    const job = dto.priority 
      ? await createHighPriorityJob(jobData)
      : await createJob(jobData);

    return {
      jobId: job.id!,
      status: 'waiting',
    };
  }

  @Get('job/:id')
  async getJobStatus(@Param('id') jobId: string): Promise<JobStatusResponse | { error: string }> {
    const status = await getJobStatus(jobId);
    
    if (!status) {
      return { error: 'Job not found' };
    }

    return {
      jobId: status.id!,
      state: status.state!,
      result: status.result,
      progress: status.progress as number,
      failedReason: status.failedReason,
      finishedOn: status.finishedOn,
      processedOn: status.processedOn,
      createdOn: status.createdOn,
    };
  }

  @Get('status')
  async getQueueStatus() {
    const { waiting, active } = await import('./queue').then(m => m.getWaitingJobs());
    
    return {
      waiting,
      active,
      healthy: waiting + active < 100,
    };
  }

  @Post('cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupJobs(@Query('olderThan') olderThan?: string) {
    const hours = olderThan ? parseInt(olderThan, 10) : 24;
    const cleaned = await import('./queue').then(m => m.clearOldJobs(hours));
    
    return {
      cleaned,
    };
  }
}
