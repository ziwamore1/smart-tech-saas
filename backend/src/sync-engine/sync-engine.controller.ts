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
      userId: req.user.id,
      schoolId: req.user.schoolId,
    });
  }

  @Post('enqueue-batch')
  enqueueBatchSync(@Request() req, @Body() body: any) {
    return this.syncEngine.enqueueBatchSync(
      req.user.id,
      req.user.schoolId,
      body.items,
    );
  }

  @Get('pending')
  getPendingSyncs(@Request() req, @Query('limit') limit?: string) {
    return this.syncEngine.getPendingSyncs(req.user.id, parseInt(limit) || 50);
  }

  @Get('status')
  getSyncStatus(@Request() req) {
    return this.syncEngine.getSyncStatus(req.user.id);
  }

  @Delete('clear-completed')
  clearCompleted(@Request() req, @Query('olderThanDays') days?: string) {
    return this.syncEngine.clearCompletedSyncs(
      req.user.id,
      parseInt(days) || 7,
    );
  }

  @Post('process-queue')
  processQueue() {
    return this.syncEngine.processSyncQueue();
  }
}
