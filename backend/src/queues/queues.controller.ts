import { Controller, Get, Post, Param, Query, Body, UseGuards, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { QueuesService } from './queues.service';

@Controller('queues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  @Roles('DIRECTOR', 'SUPER_ADMIN')
  async listQueues() {
    return { queues: this.queuesService.getRegisteredQueueNames() };
  }

  @Get('stats')
  @Roles('DIRECTOR', 'SUPER_ADMIN')
  async getAllStats() {
    return this.queuesService.getAllQueueStats();
  }

  @Get(':name/stats')
  @Roles('DIRECTOR', 'SUPER_ADMIN')
  async getQueueStats(@Param('name') name: string) {
    try {
      return this.queuesService.getQueueStats(name);
    } catch {
      return { error: `Queue '${name}' not found or not accessible` };
    }
  }

  @Get(':name/failed')
  @Roles('DIRECTOR', 'SUPER_ADMIN')
  async getFailedJobs(
    @Param('name') name: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    try {
      return this.queuesService.getFailedJobs(name, parseInt(start || '0'), parseInt(end || '20'));
    } catch {
      return { error: `Queue '${name}' not found or not accessible` };
    }
  }

  @Get(':name/jobs/:jobId')
  @Roles('DIRECTOR', 'SUPER_ADMIN', 'HEAD_TEACHER')
  async getJobStatus(@Param('name') name: string, @Param('jobId') jobId: string) {
    const status = await this.queuesService.getJobStatus(name, jobId);
    if (!status) return { error: 'Job not found' };
    return status;
  }

  @Post(':name/pause')
  @Roles('SUPER_ADMIN')
  async pauseQueue(@Param('name') name: string) {
    await this.queuesService.pauseQueue(name);
    return { message: `Queue '${name}' paused` };
  }

  @Post(':name/resume')
  @Roles('SUPER_ADMIN')
  async resumeQueue(@Param('name') name: string) {
    await this.queuesService.resumeQueue(name);
    return { message: `Queue '${name}' resumed` };
  }

  @Post(':name/clean')
  @Roles('SUPER_ADMIN', 'DIRECTOR')
  async cleanQueue(@Param('name') name: string, @Body() body: { hours?: number }) {
    await this.queuesService.cleanQueue(name, body.hours || 24);
    return { message: `Queue '${name}' cleaned (older than ${body.hours || 24}h)` };
  }

  @Post(':name/drain')
  @Roles('SUPER_ADMIN')
  async drainQueue(@Param('name') name: string) {
    await this.queuesService.drainQueue(name);
    return { message: `Queue '${name}' drained` };
  }

  @Post(':name/jobs/:jobId/retry')
  @Roles('DIRECTOR', 'SUPER_ADMIN')
  async retryJob(@Param('name') name: string, @Param('jobId') jobId: string) {
    await this.queuesService.retryJob(name, jobId);
    return { message: `Job ${jobId} retried` };
  }

  @Delete(':name/jobs/:jobId')
  @Roles('SUPER_ADMIN')
  async removeJob(@Param('name') name: string, @Param('jobId') jobId: string) {
    await this.queuesService.removeJob(name, jobId);
    return { message: `Job ${jobId} removed` };
  }
}
