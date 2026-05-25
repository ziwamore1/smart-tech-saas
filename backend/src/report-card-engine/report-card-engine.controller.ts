import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReportCardEngineService } from './report-card-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('report-card-engine')
@UseGuards(JwtAuthGuard)
export class ReportCardEngineController {
  constructor(private reportCardEngine: ReportCardEngineService) {}

  @Get('student/:studentId')
  generateReportCard(
    @Param('studentId') studentId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.reportCardEngine.generateReportCardData(
      studentId,
      termId,
      req.user.schoolId,
    );
  }

  @Get('bulk')
  generateBulkReportCards(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.reportCardEngine.generateBulkReportCards(
      classId,
      termId,
      req.user.schoolId,
    );
  }

  @Get('remarks')
  getRemarks(
    @Request() req,
    @Query('type') type?: string,
  ) {
    return this.reportCardEngine.getRemarkTemplates(req.user.schoolId, type);
  }

  @Post('remarks')
  createRemark(@Request() req, @Body() body: any) {
    return this.reportCardEngine.createRemark(req.user.schoolId, body);
  }

  @Get('status')
  getReportCardStatus(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Request() req,
  ) {
    return this.reportCardEngine.getReportCardStatus(
      classId,
      termId,
      req.user.schoolId,
    );
  }
}
