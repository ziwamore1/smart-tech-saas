import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SyncEngineService } from './sync-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sync-engine')
@UseGuards(JwtAuthGuard)
export class SyncEngineController {
  constructor(private syncEngine: SyncEngineService) {}

  @Post('enqueue')
  enqueueSync(@Request() req, @Body() body: any) {
    return this.syncEngine.enqueueSync({
      ...body,
      userId: req.user.userId,
      schoolId: req.user.schoolId,
    });
  }

  @Post('enqueue-batch')
  enqueueBatchSync(@Request() req, @Body() body: any) {
    return this.syncEngine.enqueueBatchSync(
      req.user.userId,
      req.user.schoolId,
      body.items,
    );
  }

  @Get('pending')
  getPendingSyncs(@Request() req, @Query('limit') limit?: string) {
    return this.syncEngine.getPendingSyncs(req.user.userId, parseInt(limit) || 50);
  }

  @Get('status')
  getSyncStatus(@Request() req) {
    return this.syncEngine.getSyncStatus(req.user.userId);
  }

  @Delete('clear-completed')
  clearCompleted(@Request() req, @Query('olderThanDays') days?: string) {
    return this.syncEngine.clearCompletedSyncs(
      req.user.userId,
      parseInt(days) || 7,
    );
  }

  @Post('process-queue')
  processQueue() {
    return this.syncEngine.processSyncQueue();
  }
}
