import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResultsManagementService } from './results-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('results-management')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsManagementController {
  constructor(private readonly resultsManagement: ResultsManagementService) {}

  @Get('sheets')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getSheets(
    @Query('status') status: string,
    @Query('classId') classId: string,
    @Query('termId') termId: string,
    @Query('examType') examType: string,
    @Request() req,
  ) {
    const data = await this.resultsManagement.getResultSheets(req.user.schoolId, {
      status,
      classId,
      termId,
      examType,
    });
    return { data, message: 'Result sheets retrieved successfully' };
  }

  @Get('sheets/:id')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.getResultSheet(id);
    return { data, message: 'Result sheet retrieved successfully' };
  }

  @Post('sheets')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async createSheet(
    @Body()
    body: {
      classId: string;
      termId: string;
      academicYearId: string;
      examType?: string;
      title?: string;
      description?: string;
    },
    @Request() req,
  ) {
    const data = await this.resultsManagement.createOrGetSheet({
      schoolId: req.user.schoolId,
      classId: body.classId,
      termId: body.termId,
      academicYearId: body.academicYearId,
      examType: body.examType,
      title: body.title,
      description: body.description,
      createdBy: req.user.id,
    });
    return { data, message: 'Result sheet created successfully' };
  }

  @Get('sheets/:id/students')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getSheetStudents(@Param('id') id: string) {
    const data = await this.resultsManagement.getSheetStudents(id);
    return { data, message: 'Sheet students retrieved successfully' };
  }

  @Get('sheets/:id/subjects')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getSheetSubjects(@Param('id') id: string) {
    const data = await this.resultsManagement.getSheetSubjects(id);
    return { data, message: 'Sheet subjects retrieved successfully' };
  }

  @Post('sheets/:id/submit')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async submitSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.submitSheet(id, req.user.id);
    return { data, message: 'Result sheet submitted successfully' };
  }

  @Post('sheets/:id/verify')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Class Teacher')
  async verifySheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.verifySheet(id, req.user.id);
    return { data, message: 'Result sheet verified and computed successfully' };
  }

  @Post('sheets/:id/publish')
  @Roles('Director')
  async publishSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.publishSheet(id, req.user.id);
    return { data, message: 'Result sheet published successfully' };
  }

  @Post('sheets/:id/lock')
  @Roles('Director')
  async lockSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.lockSheet(id, req.user.id);
    return { data, message: 'Result sheet locked successfully' };
  }

  @Post('sheets/:id/unlock')
  @Roles('Director')
  async unlockSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.unlockSheet(id, req.user.id);
    return { data, message: 'Result sheet unlocked successfully' };
  }

  @Get('sheets/:id/rankings')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getRankings(@Param('id') id: string, @Query('type') type: string) {
    const data = await this.resultsManagement.getRankings(id, type || 'class');
    return { data, message: 'Rankings retrieved successfully' };
  }

  @Get('sheets/:id/analysis')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getAnalysis(@Param('id') id: string) {
    const data = await this.resultsManagement.getAnalysis(id);
    return { data, message: 'Analysis retrieved successfully' };
  }

  @Get('sheets/:id/mark-schedule')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getMarkSchedule(@Param('id') id: string) {
    const data = await this.resultsManagement.getMarkSchedule(id);
    return { data, message: 'Mark schedule retrieved successfully' };
  }

  @Get('sheets/:id/mark-schedule/html')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getMarkScheduleHtml(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const html = await this.resultsManagement.generateMarkScheduleHtml(id, req.user.schoolId);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('sheets/:id/mark-schedule/pdf')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  async getMarkSchedulePdf(@Param('id') id: string, @Request() req, @Res() res: Response) {
    const pdfBuffer = await this.resultsManagement.generateMarkSchedulePdf(id, req.user.schoolId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="mark-schedule-${id.slice(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  }

  @Post('sheets/preview')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  @UseInterceptors(FileInterceptor('file'))
  async previewExcelUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('termId') termId: string,
    @Body('classId') classId: string,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }
    const data = await this.resultsManagement.previewExcelUpload(
      req.user.schoolId,
      termId,
      classId,
      file,
    );
    return { data, message: 'File preview generated successfully' };
  }

  @Post('sheets/import')
  @Roles('Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'HOD', 'Teacher', 'Class Teacher')
  @UseInterceptors(FileInterceptor('file'))
  async importExcelResults(
    @UploadedFile() file: Express.Multer.File,
    @Body('termId') termId: string,
    @Body('classId') classId: string,
    @Body('examType') examType: string,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required');
    }
    const data = await this.resultsManagement.importExcelResults(
      req.user.id,
      req.user.schoolId,
      termId,
      classId,
      examType || 'END_TERM',
      file,
    );
    return { data, message: 'Results imported successfully' };
  }

  @Get('audit-logs')
  @Roles('Director')
  async getAuditLogs(
    @Query('schoolId') schoolId: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('action') action: string,
    @Request() req,
  ) {
    const data = await this.resultsManagement.getAuditLogs(
      schoolId || req.user.schoolId,
      { entityType, entityId, action },
    );
    return { data, message: 'Audit logs retrieved successfully' };
  }

  @Post('sheets/backfill-counts')
  @Roles('Director', 'Deputy Director', 'Head Teacher')
  async backfillSheetCounts(@Request() req) {
    const result = await this.resultsManagement.backfillAllSheetCounts(req.user.schoolId);
    return { data: result, message: `Backfilled ${result.updated} sheets, ${result.alreadyCorrect} already correct` };
  }
}
