import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessCalendarService } from './business-calendar.service';

@Controller('business-calendar')
@UseGuards(JwtAuthGuard)
export class BusinessCalendarController {
  constructor(private readonly service: BusinessCalendarService) {}
  private school(req: any, body?: any, query?: any) { return req.user.schoolId || (req.user.isSuperAdmin ? body?.schoolId || query?.schoolId : undefined); }

  @Get() list(@Req() req: any, @Query('current') current?: string, @Query('schoolId') schoolId?: string) { return this.service.list(req.user, this.school(req, undefined, { schoolId }), current === 'true'); }
  @Get('current') current(@Req() req: any, @Query('schoolId') schoolId?: string) { return this.service.list(req.user, this.school(req, undefined, { schoolId }), true); }
  @Post() create(@Req() req: any, @Body() body: any) { return this.service.create(req.user, body, this.school(req, body)); }
  @Patch(':id') update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.update(req.user, id, body, this.school(req, body)); }
  @Delete(':id') remove(@Req() req: any, @Param('id') id: string, @Query('schoolId') schoolId?: string) { return this.service.remove(req.user, id, this.school(req, undefined, { schoolId })); }
  @Post(':id/publish') publish(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.setStatus(req.user, id, 'PUBLISHED', this.school(req, body)); }
  @Post(':id/unpublish') unpublish(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.setStatus(req.user, id, 'DRAFT', this.school(req, body)); }
  @Post(':id/archive') archive(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.setStatus(req.user, id, 'ARCHIVED', this.school(req, body)); }

  @Get(':id/activities') activities(@Req() req: any, @Param('id') id: string) { return this.service.activities(req.user, id, this.school(req)); }
  @Post(':id/activities') createActivity(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.createActivity(req.user, id, body, this.school(req, body)); }
  @Patch('activities/:activityId') updateActivity(@Req() req: any, @Param('activityId') id: string, @Body() body: any) { return this.service.updateActivity(req.user, id, body, this.school(req, body)); }
  @Delete('activities/:activityId') removeActivity(@Req() req: any, @Param('activityId') id: string) { return this.service.removeActivity(req.user, id, this.school(req)); }
  @Post('activities/:activityId/subitems') addSubItem(@Req() req: any, @Param('activityId') id: string, @Body() body: any) { return this.service.subItem(req.user, id, body, this.school(req, body)); }
  @Delete('subitems/:id') removeSubItem(@Req() req: any, @Param('id') id: string) { return this.service.removeSubItem(req.user, id, this.school(req)); }
  @Post('activities/:activityId/audiences') addAudience(@Req() req: any, @Param('activityId') id: string, @Body() body: any) { return this.service.audience(req.user, id, body, this.school(req, body)); }
  @Delete('audiences/:id') removeAudience(@Req() req: any, @Param('id') id: string) { return this.service.removeAudience(req.user, id, this.school(req)); }

  @Get('categories/list') categories(@Req() req: any) { return this.service.categories(req.user, this.school(req)); }
  @Post('categories') category(@Req() req: any, @Body() body: any) { return this.service.saveCategory(req.user, body, this.school(req, body)); }
  @Get(':id/columns') columns(@Req() req: any, @Param('id') id: string) { return this.service.columns(req.user, id, this.school(req)); }
  @Post(':id/columns') saveColumns(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.saveColumns(req.user, id, body.columns || body, this.school(req, body)); }
  @Get(':id/export.csv') async exportCsv(@Req() req: any, @Param('id') id: string, @Res() response: Response) { response.type('text/csv').setHeader('Content-Disposition', `attachment; filename="calendar-${id}.csv"`); response.send(await this.service.exportCsv(req.user, id, this.school(req))); }
  @Get(':id/template.xlsx') async template(@Req() req: any, @Param('id') id: string, @Res() response: Response) { response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').setHeader('Content-Disposition', `attachment; filename="calendar-template-${id}.xlsx"`); response.send(await this.service.workbook(req.user, id, false, this.school(req))); }
  @Get(':id/export.xlsx') async exportWorkbook(@Req() req: any, @Param('id') id: string, @Res() response: Response) { response.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').setHeader('Content-Disposition', `attachment; filename="calendar-${id}.xlsx"`); response.send(await this.service.workbook(req.user, id, true, this.school(req))); }
  @Post(':id/import/validate') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) validate(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: any) { if (!file) throw new BadRequestException('No xlsx file provided'); return this.service.validateWorkbook(req.user, id, file, body?.mode === 'FULL_SYNC' ? 'FULL_SYNC' : 'UPDATE_EXISTING', this.school(req, body)); }
  @Post(':id/import/preview') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) preview(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Body() body: any) { return this.service.previewWorkbook(req.user, id, body, file); }
  @Post(':id/import/commit') commit(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.commitWorkbook(req.user, id, body?.importId, body?.confirmed === true, this.school(req, body)); }
  @Get('import/:importId') importDetails(@Req() req: any, @Param('importId') importId: string) { return this.service.importDetails(req.user, importId); }
  @Get('import/:importId/errors') importErrors(@Req() req: any, @Param('importId') importId: string) { return this.service.importDetails(req.user, importId, true); }
  @Get('import/:importId/changes') importChanges(@Req() req: any, @Param('importId') importId: string) { return this.service.importDetails(req.user, importId); }
  @Post(':id/import.csv') importCsv(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.importCsv(req.user, id, body.csv || '', this.school(req, body)); }
}
