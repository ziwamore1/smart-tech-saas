import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res,
  UseGuards, Logger, Header,
} from '@nestjs/common';
import { Response } from 'express';
import { StaffRecordsService } from './staff-records.service';
import { StaffTemplateService } from './staff-template.service';
import { StaffExcelService } from './staff-excel.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PremiumFeatureGuard } from './guards/premium-feature.guard';
import { PremiumFeature } from './guards/premium-feature.decorator';

const ADMIN_ROLES = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin'];

@Controller('premium/staff-records')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffRecordsController {
  private readonly logger = new Logger(StaffRecordsController.name);

  constructor(
    private readonly staffRecordsService: StaffRecordsService,
    private readonly staffTemplateService: StaffTemplateService,
    private readonly staffExcelService: StaffExcelService,
  ) {}

  // ══════════════════════════════════════════
  // HR PROFILES
  // ══════════════════════════════════════════

  @Get('profiles')
  @Roles(...ADMIN_ROLES)
  findAllProfiles(@Req() req: any) {
    return this.staffRecordsService.findAllProfiles(req.user?.schoolId || req.query.schoolId);
  }

  @Get('profiles/:id')
  @Roles(...ADMIN_ROLES)
  findProfileById(@Param('id') id: string) {
    return this.staffRecordsService.findProfileById(id);
  }

  @Get('profiles/staff/:staffId')
  @Roles(...ADMIN_ROLES)
  findProfileByStaffId(@Param('staffId') staffId: string) {
    return this.staffRecordsService.findProfileByStaffId(staffId);
  }

  @Post('profiles')
  @Roles(...ADMIN_ROLES)
  createProfile(@Body() body: any, @Req() req: any) {
    return this.staffRecordsService.createProfile(body, req.user.schoolId);
  }

  @Put('profiles/:id')
  @Roles(...ADMIN_ROLES)
  updateProfile(@Param('id') id: string, @Body() body: any) {
    return this.staffRecordsService.updateProfile(id, body);
  }

  @Delete('profiles/:id')
  @Roles('SuperAdmin')
  deleteProfile(@Param('id') id: string) {
    return this.staffRecordsService.deleteProfile(id);
  }

  @Get('profiles/search/query')
  @Roles(...ADMIN_ROLES)
  searchProfiles(@Req() req: any, @Query('q') q: string) {
    return this.staffRecordsService.searchProfiles(req.user.schoolId, q);
  }

  // ══════════════════════════════════════════
  // EMPLOYMENT RECORDS
  // ══════════════════════════════════════════

  @Get('profiles/:profileId/employment')
  @Roles(...ADMIN_ROLES)
  findEmploymentRecords(@Param('profileId') profileId: string) {
    return this.staffRecordsService.findEmploymentRecords(profileId);
  }

  @Post('profiles/:profileId/employment')
  @Roles(...ADMIN_ROLES)
  addEmploymentRecord(@Param('profileId') profileId: string, @Body() body: any) {
    return this.staffRecordsService.addEmploymentRecord(profileId, body);
  }

  @Delete('employment/:id')
  @Roles(...ADMIN_ROLES)
  deleteEmploymentRecord(@Param('id') id: string) {
    return this.staffRecordsService.deleteEmploymentRecord(id);
  }

  // ══════════════════════════════════════════
  // POSITIONS
  // ══════════════════════════════════════════

  @Get('profiles/:profileId/positions')
  @Roles(...ADMIN_ROLES)
  findPositions(@Param('profileId') profileId: string) {
    return this.staffRecordsService.findPositions(profileId);
  }

  @Post('profiles/:profileId/positions')
  @Roles(...ADMIN_ROLES)
  addPosition(@Param('profileId') profileId: string, @Body() body: any) {
    return this.staffRecordsService.addPosition(profileId, body);
  }

  // ══════════════════════════════════════════
  // ALLOWANCES
  // ══════════════════════════════════════════

  @Get('profiles/:profileId/allowances')
  @Roles(...ADMIN_ROLES)
  findAllowances(@Param('profileId') profileId: string) {
    return this.staffRecordsService.findAllowances(profileId);
  }

  @Post('profiles/:profileId/allowances')
  @Roles(...ADMIN_ROLES)
  addAllowance(@Param('profileId') profileId: string, @Body() body: any) {
    return this.staffRecordsService.addAllowance(profileId, body);
  }

  @Post('allowances/:id/toggle')
  @Roles(...ADMIN_ROLES)
  toggleAllowance(@Param('id') id: string) {
    return this.staffRecordsService.toggleAllowance(id);
  }

  // ══════════════════════════════════════════
  // CONTRACTS
  // ══════════════════════════════════════════

  @Get('profiles/:profileId/contracts')
  @Roles(...ADMIN_ROLES)
  findContracts(@Param('profileId') profileId: string) {
    return this.staffRecordsService.findContracts(profileId);
  }

  @Post('profiles/:profileId/contracts')
  @Roles(...ADMIN_ROLES)
  addContract(@Param('profileId') profileId: string, @Body() body: any) {
    return this.staffRecordsService.addContract(profileId, body);
  }

  // ══════════════════════════════════════════
  // SYNC
  // ══════════════════════════════════════════

  @Post('sync/:id')
  @Roles(...ADMIN_ROLES)
  syncProfile(@Param('id') id: string) {
    return this.staffRecordsService.syncProfile(id);
  }

  @Post('sync-all')
  @Roles(...ADMIN_ROLES)
  syncAll(@Req() req: any) {
    return this.staffRecordsService.syncAll(req.user.schoolId);
  }

  @Get('sync/status')
  @Roles(...ADMIN_ROLES)
  getSyncStatus(@Req() req: any) {
    return this.staffRecordsService.getSyncStatus(req.user.schoolId);
  }

  @Get('sync/history')
  @Roles(...ADMIN_ROLES)
  getSyncHistory(@Req() req: any) {
    return this.staffRecordsService.getSyncHistory(req.user.schoolId);
  }

  // ══════════════════════════════════════════
  // TEMPLATES (DYNAMIC COLUMN ENGINE)
  // ══════════════════════════════════════════

  @Get('templates')
  @Roles(...ADMIN_ROLES)
  findAllTemplates(@Req() req: any) {
    return this.staffTemplateService.findAllTemplates(req.user.schoolId);
  }

  @Get('templates/:id')
  @Roles(...ADMIN_ROLES)
  findTemplateById(@Param('id') id: string) {
    return this.staffTemplateService.findTemplateById(id);
  }

  @Post('templates')
  @Roles(...ADMIN_ROLES)
  createTemplate(@Body() body: any, @Req() req: any) {
    return this.staffTemplateService.createTemplate({ ...body, schoolId: req.user.schoolId });
  }

  @Put('templates/:id')
  @Roles(...ADMIN_ROLES)
  updateTemplate(@Param('id') id: string, @Body() body: any) {
    return this.staffTemplateService.updateTemplate(id, body);
  }

  @Delete('templates/:id')
  @Roles(...ADMIN_ROLES)
  deleteTemplate(@Param('id') id: string) {
    return this.staffTemplateService.deleteTemplate(id);
  }

  @Post('templates/:id/duplicate')
  @Roles(...ADMIN_ROLES)
  duplicateTemplate(@Param('id') id: string, @Body('name') name: string) {
    return this.staffTemplateService.duplicateTemplate(id, name);
  }

  // ── Template Columns ──

  @Post('templates/:templateId/columns')
  @Roles(...ADMIN_ROLES)
  addColumn(@Param('templateId') templateId: string, @Body() body: any) {
    return this.staffTemplateService.addColumn(templateId, body);
  }

  @Put('columns/:id')
  @Roles(...ADMIN_ROLES)
  updateColumn(@Param('id') id: string, @Body() body: any) {
    return this.staffTemplateService.updateColumn(id, body);
  }

  @Delete('columns/:id')
  @Roles(...ADMIN_ROLES)
  deleteColumn(@Param('id') id: string) {
    return this.staffTemplateService.deleteColumn(id);
  }

  @Post('templates/:templateId/columns/reorder')
  @Roles(...ADMIN_ROLES)
  reorderColumns(@Param('templateId') templateId: string, @Body() body: { columns: { id: string; order: number }[] }) {
    return this.staffTemplateService.reorderColumns(templateId, body.columns);
  }

  // ══════════════════════════════════════════
  // SUBMISSIONS (STAFF RETURNS)
  // ══════════════════════════════════════════

  @Get('submissions')
  @Roles(...ADMIN_ROLES)
  findAllSubmissions(@Req() req: any, @Query('templateId') templateId?: string) {
    return this.staffTemplateService.findAllSubmissions(req.user.schoolId, templateId);
  }

  @Get('submissions/:id')
  @Roles(...ADMIN_ROLES)
  findSubmissionById(@Param('id') id: string) {
    return this.staffTemplateService.findSubmissionById(id);
  }

  @Post('submissions')
  @Roles(...ADMIN_ROLES)
  createSubmission(@Body() body: any, @Req() req: any) {
    return this.staffTemplateService.createSubmission({ ...body, schoolId: req.user.schoolId });
  }

  @Put('submissions/:id/data')
  @Roles(...ADMIN_ROLES)
  updateSubmissionData(@Param('id') id: string, @Body('data') data: any[]) {
    return this.staffTemplateService.updateSubmission(id, data);
  }

  @Post('submissions/:id/submit')
  @Roles(...ADMIN_ROLES)
  submitSubmission(@Param('id') id: string, @Req() req: any) {
    return this.staffTemplateService.submitSubmission(id, req.user?.sub || req.user?.id);
  }

  @Post('submissions/:id/approve')
  @Roles('Director', 'SuperAdmin')
  approveSubmission(@Param('id') id: string, @Req() req: any) {
    return this.staffTemplateService.approveSubmission(id, req.user?.sub || req.user?.id);
  }

  @Delete('submissions/:id')
  @Roles(...ADMIN_ROLES)
  deleteSubmission(@Param('id') id: string) {
    return this.staffTemplateService.deleteSubmission(id);
  }

  // ══════════════════════════════════════════
  // EXCEL EXPORTS
  // ══════════════════════════════════════════

  @Get('exports/submission/:id')
  @Roles(...ADMIN_ROLES)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportSubmissionExcel(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const school = await this.staffRecordsService.getSchoolInfo(req.user.schoolId);
    const buffer = await this.staffExcelService.generateStaffReturnExcel(id, {
      schoolName: school?.name,
      province: school?.province,
      district: school?.district,
      academicYear: req.query.academicYear,
      term: req.query.term,
      generatedBy: req.user?.sub || req.user?.id,
    });
    res.setHeader('Content-Disposition', `attachment; filename="staff-return-${id.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  }

  @Get('exports/template/:id')
  @Roles(...ADMIN_ROLES)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportTemplateExcel(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const school = await this.staffRecordsService.getSchoolInfo(req.user.schoolId);
    const buffer = await this.staffExcelService.generateTemplateExcel(id, {
      schoolName: school?.name,
    });
    res.setHeader('Content-Disposition', `attachment; filename="template-${id.slice(0, 8)}.xlsx"`);
    res.send(buffer);
  }

  @Get('exports/profiles')
  @Roles(...ADMIN_ROLES)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async exportProfilesExcel(@Req() req: any, @Res() res: Response) {
    const school = await this.staffRecordsService.getSchoolInfo(req.user.schoolId);
    const buffer = await this.staffExcelService.generateStaffProfileExport(req.user.schoolId, {
      schoolName: school?.name,
    });
    res.setHeader('Content-Disposition', `attachment; filename="staff-profiles.xlsx"`);
    res.send(buffer);
  }

  // ══════════════════════════════════════════
  // TRANSFERS
  // ══════════════════════════════════════════

  @Get('transfers')
  @Roles(...ADMIN_ROLES)
  findAllTransfers(@Req() req: any) {
    return this.staffRecordsService.findAllTransfers(req.user.schoolId);
  }

  @Get('transfers/:id')
  @Roles(...ADMIN_ROLES)
  findTransferById(@Param('id') id: string) {
    return this.staffRecordsService.findTransferById(id);
  }

  @Post('transfers')
  @Roles(...ADMIN_ROLES)
  createTransfer(@Body() body: any) {
    return this.staffRecordsService.createTransfer(body);
  }

  @Post('transfers/:id/approve')
  @Roles('Director', 'SuperAdmin')
  approveTransfer(@Param('id') id: string, @Req() req: any) {
    return this.staffRecordsService.approveTransfer(id, req.user?.sub || req.user?.id);
  }

  @Post('transfers/:id/complete')
  @Roles(...ADMIN_ROLES)
  completeTransfer(@Param('id') id: string) {
    return this.staffRecordsService.completeTransfer(id);
  }

  @Delete('transfers/:id')
  @Roles('SuperAdmin')
  deleteTransfer(@Param('id') id: string) {
    return this.staffRecordsService.deleteTransfer(id);
  }

  // ══════════════════════════════════════════
  // QUALIFICATIONS
  // ══════════════════════════════════════════

  @Get('qualifications/:profileId')
  @Roles(...ADMIN_ROLES)
  findQualificationsByProfile(@Param('profileId') profileId: string) {
    return this.staffRecordsService.findQualificationsByProfile(profileId);
  }

  @Post('qualifications')
  @Roles(...ADMIN_ROLES)
  addQualification(@Body() body: any) {
    return this.staffRecordsService.addQualification(body);
  }

  @Post('qualifications/:id/verify')
  @Roles('Director', 'SuperAdmin')
  verifyQualification(@Param('id') id: string, @Req() req: any) {
    return this.staffRecordsService.verifyQualification(id, req.user?.sub || req.user?.id);
  }

  @Delete('qualifications/:id')
  @Roles('Director', 'SuperAdmin')
  deleteQualification(@Param('id') id: string) {
    return this.staffRecordsService.deleteQualification(id);
  }

  // ══════════════════════════════════════════
  // AUDIT LOGS
  // ══════════════════════════════════════════

  @Get('audit-logs')
  @Roles(...ADMIN_ROLES)
  getAuditLogs(@Req() req: any) {
    return this.staffTemplateService.getAuditLogs(req.user.schoolId);
  }

  // ══════════════════════════════════════════
  // ANALYTICS
  // ══════════════════════════════════════════

  @Get('analytics')
  @Roles(...ADMIN_ROLES)
  getStaffAnalytics(@Req() req: any) {
    return this.staffRecordsService.getStaffAnalytics(req.user.schoolId);
  }

  @Get('analytics/district/:district')
  @Roles('Director', 'SuperAdmin')
  getDistrictStaffSummary(@Param('district') district: string) {
    return this.staffRecordsService.getDistrictStaffSummary(district);
  }
}
