import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CommunicationsCloudService } from '../communications-cloud.service';

@Processor('communications-cloud', { concurrency: 20 })
export class CommunicationQueueWorker extends WorkerHost {
  private readonly logger = new Logger(CommunicationQueueWorker.name);

  constructor(
    private readonly communicationsCloudService: CommunicationsCloudService,
  ) { super(); }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} for message ${job.data.id}`);
    return this.communicationsCloudService.processMessage(job.data);
  }
}
