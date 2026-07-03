import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CommunicationQueueService } from './communication-queue.service';

@Controller('communications-cloud/queue')
@UseGuards(JwtAuthGuard)
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
