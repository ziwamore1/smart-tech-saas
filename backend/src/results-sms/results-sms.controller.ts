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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('results-sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
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
    @Body() data: { classId: string; termId: string; parentIds?: string[]; studentIds?: string[]; allowResend?: boolean },
  ) {
    return this.resultsSmsService.sendResultsSms(
      req.user.schoolId,
      data.classId,
      data.termId,
      req.user.id,
      { parentIds: data.parentIds, studentIds: data.studentIds, allowResend: data.allowResend },
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
  async getLogById(@Request() req: any, @Param('id') id: string) {
    return this.resultsSmsService.getLogById(req.user.schoolId, id);
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

  @Get('dashboard')
  async getDashboard(@Request() req: any) {
    return this.resultsSmsService.getDashboard(req.user.schoolId);
  }

  @Post('logs/:id/retry')
  async retry(@Request() req: any, @Param('id') id: string) {
    return this.resultsSmsService.retryLog(req.user.schoolId, id, req.user.id);
  }

  @Post('logs/:id/delivery-status')
  async updateDeliveryStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { status: string; providerResponse?: string },
  ) {
    return this.resultsSmsService.updateDeliveryStatus(req.user.schoolId, id, data.status, data.providerResponse);
  }
}
