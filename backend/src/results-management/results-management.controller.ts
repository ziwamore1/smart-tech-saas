import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ResultsManagementService } from './results-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('results-management')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResultsManagementController {
  constructor(private readonly resultsManagement: ResultsManagementService) {}

  @Get('sheets')
  @Roles('DIRECTOR', 'TEACHER', 'CLASS_TEACHER')
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
  @Roles('DIRECTOR', 'TEACHER', 'CLASS_TEACHER')
  async getSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.getResultSheet(id);
    return { data, message: 'Result sheet retrieved successfully' };
  }

  @Post('sheets')
  @Roles('DIRECTOR', 'CLASS_TEACHER')
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
  @Roles('DIRECTOR', 'TEACHER', 'CLASS_TEACHER')
  async getSheetStudents(@Param('id') id: string) {
    const data = await this.resultsManagement.getSheetStudents(id);
    return { data, message: 'Sheet students retrieved successfully' };
  }

  @Get('sheets/:id/subjects')
  @Roles('DIRECTOR', 'TEACHER', 'CLASS_TEACHER')
  async getSheetSubjects(@Param('id') id: string) {
    const data = await this.resultsManagement.getSheetSubjects(id);
    return { data, message: 'Sheet subjects retrieved successfully' };
  }

  @Post('sheets/:id/submit')
  @Roles('CLASS_TEACHER', 'TEACHER')
  async submitSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.submitSheet(id, req.user.id);
    return { data, message: 'Result sheet submitted successfully' };
  }

  @Post('sheets/:id/verify')
  @Roles('DIRECTOR', 'CLASS_TEACHER')
  async verifySheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.verifySheet(id, req.user.id);
    return { data, message: 'Result sheet verified and computed successfully' };
  }

  @Post('sheets/:id/publish')
  @Roles('DIRECTOR')
  async publishSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.publishSheet(id, req.user.id);
    return { data, message: 'Result sheet published successfully' };
  }

  @Post('sheets/:id/lock')
  @Roles('DIRECTOR')
  async lockSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.lockSheet(id, req.user.id);
    return { data, message: 'Result sheet locked successfully' };
  }

  @Post('sheets/:id/unlock')
  @Roles('DIRECTOR')
  async unlockSheet(@Param('id') id: string, @Request() req) {
    const data = await this.resultsManagement.unlockSheet(id, req.user.id);
    return { data, message: 'Result sheet unlocked successfully' };
  }

  @Get('sheets/:id/rankings')
  @Roles('DIRECTOR', 'TEACHER', 'CLASS_TEACHER')
  async getRankings(
    @Param('id') id: string,
    @Query('type') type: string,
  ) {
    const data = await this.resultsManagement.getRankings(id, type || 'class');
    return { data, message: 'Rankings retrieved successfully' };
  }

  @Get('sheets/:id/analysis')
  @Roles('DIRECTOR', 'CLASS_TEACHER')
  async getAnalysis(@Param('id') id: string) {
    const data = await this.resultsManagement.getAnalysis(id);
    return { data, message: 'Analysis retrieved successfully' };
  }

  @Get('sheets/:id/mark-schedule')
  @Roles('DIRECTOR', 'TEACHER', 'CLASS_TEACHER')
  async getMarkSchedule(@Param('id') id: string) {
    const data = await this.resultsManagement.getMarkSchedule(id);
    return { data, message: 'Mark schedule retrieved successfully' };
  }

  @Get('audit-logs')
  @Roles('DIRECTOR')
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
}
