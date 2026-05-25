import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentEngineService } from '../assessment-engine/assessment-engine.service';

export interface SyncQueueItem {
  userId: string;
  schoolId: string;
  operationType: string;
  entityType: string;
  entityId?: string;
  payload: any;
  priority?: number;
}

@Injectable()
export class SyncEngineService {
  private readonly logger = new Logger(SyncEngineService.name);

  constructor(
    private prisma: PrismaService,
    private assessmentEngine: AssessmentEngineService,
  ) {}

  async enqueueSync(data: SyncQueueItem) {
    return this.prisma.syncQueue.create({
      data: {
        userId: data.userId,
        schoolId: data.schoolId,
        operationType: data.operationType as any,
        entityType: data.entityType as any,
        entityId: data.entityId,
        payload: data.payload,
        priority: data.priority ?? 0,
      },
    });
  }

  async enqueueBatchSync(userId: string, schoolId: string, items: SyncQueueItem[]) {
    return this.prisma.syncQueue.createMany({
      data: items.map(item => ({
        userId,
        schoolId,
        operationType: item.operationType as any,
        entityType: item.entityType as any,
        entityId: item.entityId,
        payload: item.payload,
        priority: item.priority ?? 0,
      })),
    });
  }

  async getPendingSyncs(userId: string, limit = 50) {
    return this.prisma.syncQueue.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'RETRYING'] },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: limit,
    });
  }

  async processSyncQueue() {
    const pendingItems = await this.prisma.syncQueue.findMany({
      where: {
        status: { in: ['PENDING', 'RETRYING'] },
        retryCount: { lt: 3 },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 100,
    });

    if (pendingItems.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        await this.prisma.syncQueue.update({
          where: { id: item.id },
          data: { status: 'PROCESSING' },
        });

        await this.executeSyncOperation(item);

        await this.prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });

        processed++;
      } catch (error) {
        this.logger.error(`Failed to process sync item ${item.id}: ${error.message}`);

        const retryCount = item.retryCount + 1;

        await this.prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            status: retryCount >= 3 ? 'FAILED' : 'RETRYING',
            retryCount,
            errorMessage: error.message,
          },
        });

        failed++;
      }
    }

    this.logger.log(`Processed ${processed} sync items, ${failed} failed`);

    return { processed, failed };
  }

  private async executeSyncOperation(item: any) {
    const { operationType, entityType, payload } = item;

    switch (entityType) {
      case 'ASSESSMENT_RESULT':
        await this.executeAssessmentResultSync(operationType, payload);
        break;
      case 'BATCH_CREATE':
        await this.executeBatchCreate(payload);
        break;
      default:
        this.logger.warn(`Unknown entity type: ${entityType}`);
    }
  }

  private async executeAssessmentResultSync(operationType: string, payload: any) {
    switch (operationType) {
      case 'CREATE':
      case 'UPDATE':
        await this.assessmentEngine.enterSingleScore(payload.schoolId, {
          studentId: payload.studentId,
          subjectId: payload.subjectId,
          termId: payload.termId,
          classId: payload.classId,
          assessmentDefId: payload.assessmentDefId,
          rawScore: payload.rawScore,
          maxScore: payload.maxScore,
          remarks: payload.remarks,
          enteredBy: payload.enteredBy,
        });
        break;
      default:
        this.logger.warn(`Unknown operation type: ${operationType}`);
    }
  }

  private async executeBatchCreate(payload: any) {
    await this.assessmentEngine.bulkEnterScores(payload.schoolId, {
      classId: payload.classId,
      subjectId: payload.subjectId,
      termId: payload.termId,
      assessmentDefId: payload.assessmentDefId,
      title: payload.title,
      maxScore: payload.maxScore,
      scores: payload.scores,
      enteredBy: payload.enteredBy,
    });
  }

  async getSyncStatus(userId: string) {
    const [pending, processing, completed, failed] = await Promise.all([
      this.prisma.syncQueue.count({
        where: { userId, status: 'PENDING' },
      }),
      this.prisma.syncQueue.count({
        where: { userId, status: 'PROCESSING' },
      }),
      this.prisma.syncQueue.count({
        where: { userId, status: 'COMPLETED' },
      }),
      this.prisma.syncQueue.count({
        where: { userId, status: 'FAILED' },
      }),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      total: pending + processing + completed + failed,
    };
  }

  async clearCompletedSyncs(userId: string, olderThanDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.syncQueue.deleteMany({
      where: {
        userId,
        status: 'COMPLETED',
        processedAt: { lt: cutoffDate },
      },
    });

    this.logger.log(`Cleared ${result.count} completed sync items for user ${userId}`);

    return result;
  }
}
