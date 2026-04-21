import {
  Controller,
  Post,
  Get,
  Patch,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  Param,
} from '@nestjs/common';
import { PublishingService } from './publishing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('publishing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PublishingController {
  constructor(private service: PublishingService) {}

  @Post('publish-results')
  @Roles('DIRECTOR')
  publishResults(
    @Body() body: { classId: string; termId: string },
    @Req() req: any,
  ) {
    return this.service.publishResults(
      req.user.schoolId,
      body.classId,
      body.termId,
    );
  }

  @Post('publish-all')
  @Roles('DIRECTOR')
  publishAllClasses(
    @Body() body: { termId: string },
    @Req() req: any,
  ) {
    return this.service.publishAllClasses(req.user.schoolId, body.termId);
  }

  @Post('unpublish-results')
  @Roles('DIRECTOR')
  unpublishResults(
    @Body() body: { classId: string; termId: string },
    @Req() req: any,
  ) {
    return this.service.unpublishResults(
      req.user.schoolId,
      body.classId,
      body.termId,
    );
  }

  @Get('status')
  @Roles('DIRECTOR', 'TEACHER')
  getStatus(@Req() req: any) {
    return this.service.getPublicationStatus(req.user.schoolId);
  }

  @Get('status/:termId')
  @Roles('DIRECTOR')
  getTermLockStatus(
    @Param('termId') termId: string,
    @Req() req: any,
  ) {
    return this.service.getTermLockStatus(req.user.schoolId, termId);
  }

  @Get('check-completeness')
  @Roles('DIRECTOR', 'TEACHER')
  checkCompleteness(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    return this.service.checkResultsCompletenessByClass(
      req.user.schoolId,
      classId,
      termId,
    );
  }

  @Get('results-summary')
  @Roles('DIRECTOR', 'TEACHER')
  getResultsSummary(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req: any,
  ) {
    return this.service.getResultsSummaryByClass(
      req.user.schoolId,
      classId,
      termId,
    );
  }

  @Get('download-zip')
  @Roles('DIRECTOR', 'TEACHER')
  async downloadZip(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req,
    @Res() res,
  ) {
    const stream = await this.service.downloadClassReportsZip(
      req.user.schoolId,
      classId,
      termId,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="report-cards-${classId}.zip"`,
    });

    stream.pipe(res);
  }

  @Get('class-summary-pdf')
  @Roles('DIRECTOR', 'TEACHER')
  async downloadClassSummaryPdf(
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Req() req,
    @Res() res,
  ) {
    const pdf = await this.service.generateClassSummaryPdf(
      req.user.schoolId,
      classId,
      termId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="class-summary-${classId}.pdf"`,
    });
    res.send(pdf);
  }
}
