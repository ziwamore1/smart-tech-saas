import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ResultsSmsService } from './results-sms.service';
import { QUEUE_NAMES } from '../queues/queue-definitions';

@Processor(QUEUE_NAMES.RESULTS_SMS, { concurrency: 20 })
export class ResultsSmsWorker extends WorkerHost {
  constructor(private readonly resultsSmsService: ResultsSmsService) {
    super();
  }

  process(job: Job): Promise<void> {
    return this.resultsSmsService.processQueuedBatch(job.data);
  }
}
