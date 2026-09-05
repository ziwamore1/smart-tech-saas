import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { QueuesService } from '../queues/queues.service';
import { QUEUE_NAMES } from '../queues/queue-definitions';
import {
  ResultsSmsService,
  RESULTS_SMS_BATCH_STATUSES,
  resultsSmsStallMs,
  resultsSmsQueueGraceMs,
} from './results-sms.service';

/**
 * Watches every active Results SMS batch and guarantees that a batch can never
 * silently sit at "0 sent / 0 failed / all pending" forever:
 *
 *  1. Heartbeat: the worker persists heartbeatAt on every batch sync; this
 *     monitor compares it to the (configurable) stall threshold.
 *  2. Stuck detection & recovery: if a batch is queued past the grace period,
 *     or active with a stale heartbeat while the queue is NOT consuming
 *     anything, this monitor takes over and processes the remaining recipients
 *     directly (in the API process). Atomic per-recipient claims mean a
 *     dedicated worker and this fallback can never send the same SMS twice.
 *  3. Stranded in-flight sends from a crashed worker are classified rather than
 *     blindly re-sent (avoids duplicate SMS delivery).
 *  4. Due retries are resumed and batches with no remaining work are finalized
 *     into a terminal state.
 */
@Injectable()
export class ResultsSmsMonitor {
  private readonly logger = new Logger(ResultsSmsMonitor.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queuesService: QueuesService,
    private readonly resultsSmsService: ResultsSmsService,
  ) {}

  @Cron('*/15 * * * * *')
  async scan(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const startedAt = Date.now();
      const batches = await this.prisma.resultSmsBatch.findMany({
        where: { status: { in: RESULTS_SMS_BATCH_STATUSES.ACTIVE } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const batch of batches) {
        try {
          await this.reconcileBatch(batch);
        } catch (err) {
          this.logger.error(`Monitor failed to reconcile batch ${batch.id}: ${(err as Error).message}`);
        }
      }
      this.logger.debug(`Results SMS monitor scan finished in ${Date.now() - startedAt}ms`);
    } catch (err) {
      this.logger.error(`Results SMS monitor scan failed: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  private async reconcileBatch(batch: any): Promise<void> {
    const job = await this.queuesService.getJobStatus(QUEUE_NAMES.RESULTS_SMS, batch.id).catch(() => null);
    const stats = await this.queuesService.getQueueStats(QUEUE_NAMES.RESULTS_SMS).catch(() => null);
    const queueConsuming = stats ? stats.active > 0 : false;
    const jobActive = job ? job.status === 'active' : false;
    const workerAlive = queueConsuming || jobActive;
    const now = Date.now();
    const heartbeatMs = batch.heartbeatAt ? now - batch.heartbeatAt.getTime() : null;
    const activityMs = now - batch.lastActivityAt.getTime();
    const stallMs = resultsSmsStallMs();

    // Determine whether the queue is unable to make progress and this monitor
    // must act as the fallback worker.
    let takeOver = false;
    if (batch.status === 'QUEUED') {
      const ageMs = now - batch.queuedAt.getTime();
      if (ageMs > resultsSmsQueueGraceMs() && !workerAlive) takeOver = true;
    } else if (batch.status === 'STARTING' || batch.status === 'PROCESSING') {
      const staleHeartbeat = heartbeatMs !== null ? heartbeatMs > stallMs : activityMs > stallMs;
      if (staleHeartbeat && !workerAlive) takeOver = true;
    }

    const nowDate = new Date();
    const unclaimed = await this.prisma.resultSmsLog.count({
      where: { schoolId: batch.schoolId, batchId: batch.id, status: { in: ['QUEUED', 'PENDING', 'SENDING'] } },
    });
    const futureRetries = await this.prisma.resultSmsLog.count({
      where: { schoolId: batch.schoolId, batchId: batch.id, status: 'RETRYING', nextRetryAt: { gt: nowDate } },
    });

    if (takeOver) {
      // A crashed worker may have left messages in-flight. Without a delivery
      // result we cannot prove they were sent, so classify them rather than
      // resend and risk a duplicate SMS.
      await this.prisma.resultSmsLog.updateMany({
        where: { schoolId: batch.schoolId, batchId: batch.id, status: 'SENDING' },
        data: {
          status: 'PROVIDER_ERROR',
          failureCode: 'WORKER_INTERRUPTED',
          errorMessage: 'The message was interrupted when the SMS worker stopped without a delivery result. It was not re-sent automatically.',
          errorSuggestion: 'Retry this message to continue.',
          failedAt: nowDate,
        },
      });
      await this.resultsSmsService.syncBatchCounts(batch.id, batch.schoolId);
      this.logger.warn(`Taking over batch ${batch.id} (status ${batch.status}, worker alive=${workerAlive}, last activity ${Math.round(activityMs / 1000)}s ago)`);
    }

    // Due retries are not consumed by BullMQ (their original job already
    // finished), so the monitor is the component that resumes them.
    const dueRetries = await this.prisma.resultSmsLog.findMany({
      where: {
        schoolId: batch.schoolId, batchId: batch.id,
        status: 'RETRYING', nextRetryAt: { lte: nowDate },
      },
      select: { id: true, phoneNumber: true, message: true },
    });
    const processable = dueRetries;

    if (takeOver) {
      // Also pick up recipients the dead queue never started.
      const stranded = await this.prisma.resultSmsLog.findMany({
        where: { schoolId: batch.schoolId, batchId: batch.id, status: { in: ['QUEUED', 'PENDING'] } },
        select: { id: true, phoneNumber: true, message: true },
      });
      processable.push(...stranded);
    }

    if (processable.length > 0) {
      if (takeOver) this.logger.warn(`Processing ${processable.length} recipient(s) for batch ${batch.id} (recovery)`);
      else this.logger.log(`Resuming ${processable.length} due retry/recipient(s) for batch ${batch.id}`);
      await this.resultsSmsService.processQueuedBatch({
        batchId: batch.id,
        schoolId: batch.schoolId,
        logs: processable.map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } })),
      });
      return;
    }

    // No one is processing this batch anymore and nothing is left to do —
    // reconcile the persisted terminal state.
    if (unclaimed === 0 && futureRetries === 0) {
      await this.resultsSmsService.finalizeBatch(batch.id, batch.schoolId);
    }
  }
}