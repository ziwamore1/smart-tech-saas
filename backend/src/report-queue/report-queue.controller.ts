import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  Res,
  HttpStatus,
  Body,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportQueueService } from './report-queue.service';
import type { Response } from 'express';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportQueueController {
  constructor(private readonly reportQueue: ReportQueueService) {}

  @Post('generate')
  @Roles('DIRECTOR', 'HEAD_TEACHER', 'TEACHER')
  async generateReport(
    @Body() body: { type: string; params: Record<string, any>; priority?: number; delay?: number },
    @Req() req: any,
  ) {
    const validTypes = ['report-card', 'transcript', 'analytics-summary', 'performance-profile'];
    if (!validTypes.includes(body.type)) {
      throw new BadRequestException(`Invalid report type. Must be one of: ${validTypes.join(', ')}`);
    }

    const schoolId = req.user.schoolId;
    return this.reportQueue.enqueueReport({
      type: body.type as any,
      schoolId,
      params: body.params,
      priority: body.priority,
      delay: body.delay,
    });
  }

  @Post('generate/class')
  @Roles('DIRECTOR', 'HEAD_TEACHER')
  async generateClassReports(
    @Body() body: { classId: string; termId: string; type?: string },
    @Req() req: any,
  ) {
    const type = body.type || 'report-card';
    const validTypes = ['report-card', 'analytics-summary'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid report type for class generation: ${type}`);
    }

    const schoolId = req.user.schoolId;

    return this.reportQueue.enqueueReport({
      type: type as any,
      schoolId,
      params: { classId: body.classId, termId: body.termId },
    });
  }

  @Post('generate/student')
  @Roles('DIRECTOR', 'HEAD_TEACHER', 'TEACHER')
  async generateStudentReport(
    @Body() body: { studentId: string; termId: string; type?: string },
    @Req() req: any,
  ) {
    const type = body.type || 'report-card';
    const validTypes = ['report-card', 'performance-profile'];
    if (!validTypes.includes(type)) {
      throw new BadRequestException(`Invalid report type for student: ${type}`);
    }

    return this.reportQueue.enqueueReport({
      type: type as any,
      schoolId: req.user.schoolId,
      params: { studentId: body.studentId, termId: body.termId },
    });
  }

  @Get('status/:jobId')
  async getStatus(@Param('jobId') jobId: string, @Req() req: any) {
    const status = await this.reportQueue.getJobStatus(jobId);
    if (!status) {
      throw new NotFoundException('Job not found');
    }
    return status;
  }

  @Get('download/:jobId')
  async downloadPdf(
    @Param('jobId') jobId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const schoolId = req.user.schoolId;
    const buffer = await this.reportQueue.getDownloadBuffer(schoolId, jobId);

    if (!buffer) {
      const status = await this.reportQueue.getJobStatus(jobId);
      if (!status) {
        throw new NotFoundException('Job not found');
      }
      if (status.status === 'completed') {
        throw new NotFoundException('PDF file not found on storage');
      }
      throw new BadRequestException(`Report is still ${status.status}. Please try again later.`);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${jobId}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('queue/stats')
  @Roles('DIRECTOR', 'HEAD_TEACHER')
  async getQueueStats(@Req() req: any) {
    return this.reportQueue.getStats();
  }

  @Post('queue/clean')
  @Roles('DIRECTOR')
  async cleanQueue(@Body() body: { hours?: number }) {
    await this.reportQueue.clean(body.hours || 24);
    return { message: `Queue cleaned (older than ${body.hours || 24}h)` };
  }
}
