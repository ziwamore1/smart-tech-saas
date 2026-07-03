import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CommunicationsCloudService } from '../communications-cloud.service';

@Injectable()
export class CommunicationQueueWorker {
  private readonly logger = new Logger(CommunicationQueueWorker.name);

  constructor(
    private readonly communicationsCloudService: CommunicationsCloudService,
  ) {}

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} for message ${job.data.id}`);
    return this.communicationsCloudService.processMessage(job.data);
  }
}
