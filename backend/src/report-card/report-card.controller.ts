import { Controller, Get, Param, Req, UseGuards, Res } from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { ReportCardService } from './report-card.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('report-card')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportCardController {
  constructor(private readonly reportCardService: ReportCardService) {}

  @Get('class/:classId/term/:termId/pdf')
  async downloadClassReports(
    @Req() req,
    @Param('classId') classId: string,
    @Param('termId') termId: string,
    @Res() res: any,
  ) {
    const schoolId = req.user.schoolId;

    const pdf = await this.reportCardService.generateClassReportCardsPdf(
      schoolId,
      classId,
      termId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=class-report-cards.pdf',
    });

    res.send(pdf);
  }

  @Get('transcript/:studentId/pdf')
  async downloadTranscript(
    @Req() req,
    @Param('studentId') studentId: string,
    @Res() res: any,
  ) {
    const schoolId = req.user.schoolId;

    const pdf = await this.reportCardService.generateStudentTranscript(
      schoolId,
      studentId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="transcript-${studentId}.pdf"`,
    });
    res.send(pdf);
  }

  @Get(':studentId/:termId')
  @Roles('Director')
  getReportCard(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Req() req: any,
  ) {
    return this.reportCardService.getReportCard(
      req.user.schoolId,
      studentId,
      termId,
    );
  }

  @Get(':studentId/:termId/pdf')
  async downloadReportCard(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Req() req,
    @Res() res,
  ) {
    const schoolId = req.user.schoolId;

    const pdf = await this.reportCardService.generateReportCardPdf(
      schoolId,
      studentId,
      termId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-card-${studentId}-${termId}.pdf"`,
    });
    res.send(pdf);
  }

  @Get(':studentId/:termId/curriculum-pdf')
  @Roles('Director', 'Class Teacher')
  async downloadCurriculumReportCard(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @Req() req,
    @Res() res,
  ) {
    const schoolId = req.user.schoolId;

    const pdf = await this.reportCardService.generateCurriculumReportCardPdf(
      schoolId,
      studentId,
      termId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="curriculum-report-${studentId}-${termId}.pdf"`,
    });
    res.send(pdf);
  }

  @Get('class/:classId/term/:termId/curriculum-pdf')
  @Roles('Director', 'Class Teacher')
  async downloadClassCurriculumReports(
    @Req() req,
    @Param('classId') classId: string,
    @Param('termId') termId: string,
    @Res() res,
  ) {
    const schoolId = req.user.schoolId;

    const pdf = await this.reportCardService.generateClassCurriculumReportCardsPdf(
      schoolId,
      classId,
      termId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=class-curriculum-report-cards.pdf',
    });
    res.send(pdf);
  }
}
