import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ResultsSmsService } from './results-sms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('results-sms')
@UseGuards(JwtAuthGuard)
export class ResultsSmsController {
  constructor(private readonly resultsSmsService: ResultsSmsService) {}

  @Get('preview')
  async previewResultsSms(
    @Request() req: any,
    @Query('classId') classId: string,
    @Query('termId') termId: string,
  ) {
    return this.resultsSmsService.getRecipients(req.user.schoolId, classId, termId);
  }

  @Post('send')
  async sendResultsSms(
    @Request() req: any,
    @Body() data: { classId: string; termId: string; parentIds?: string[] },
  ) {
    return this.resultsSmsService.sendResultsSms(
      req.user.schoolId,
      data.classId,
      data.termId,
      req.user.id,
      { parentIds: data.parentIds },
    );
  }

  @Post('auto-send')
  async autoSendOnPublish(
    @Request() req: any,
    @Body() data: { classId: string; termId: string },
  ) {
    return this.resultsSmsService.autoSendOnPublish(
      req.user.schoolId,
      data.classId,
      data.termId,
      req.user.id,
    );
  }

  @Get('history')
  async getHistory(
    @Request() req: any,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
  ) {
    return this.resultsSmsService.getHistory(req.user.schoolId, classId, termId);
  }

  @Get('batches/:batchId')
  async getBatchLogs(@Request() req: any, @Param('batchId') batchId: string) {
    return this.resultsSmsService.getBatchLogs(req.user.schoolId, batchId);
  }

  @Get('logs/:id')
  async getLogById(@Param('id') id: string) {
    return this.resultsSmsService.getLogById(id);
  }

  @Get('failed')
  async getFailedLogs(
    @Request() req: any,
    @Query('batchId') batchId?: string,
  ) {
    return this.resultsSmsService.getFailedLogs(req.user.schoolId, batchId);
  }

  @Get('settings')
  async getSmsSettings(@Request() req: any) {
    return this.resultsSmsService.getSmsSettings(req.user.schoolId);
  }
}
