import { Controller, Get, Post, Param } from '@nestjs/common';
import { CommunicationQueueService } from './communication-queue.service';

@Controller('communications-cloud/queue')
export class CommunicationQueueController {
  constructor(private readonly queueService: CommunicationQueueService) {}

  @Get('status')
  async getQueueStatus() {
    return this.queueService.getQueueStatus();
  }

  @Get('failed')
  async getFailedJobs() {
    return this.queueService.getFailedMessages();
  }

  @Post('retry/:jobId')
  async retryJob(@Param('jobId') jobId: string) {
    return this.queueService.retryMessage(jobId);
  }
}
