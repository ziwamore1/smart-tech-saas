import { Controller, Get, Post, Body, Query, Res, UseGuards } from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Response } from 'express';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarSyncController {
  constructor(private calendarSyncService: CalendarSyncService) {}

  @Get('google/auth-url')
  async getGoogleAuthUrl(@Query('schoolId') schoolId: string) {
    return this.calendarSyncService.getGoogleAuthUrl(schoolId);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') schoolId: string,
  ) {
    return this.calendarSyncService.googleCallback(schoolId, code);
  }

  @Get('google/status')
  async getGoogleStatus(@Query('schoolId') schoolId: string) {
    return this.calendarSyncService.getGoogleStatus(schoolId);
  }

  @Post('google/disconnect')
  async disconnectGoogle(@Query('schoolId') schoolId: string) {
    return this.calendarSyncService.disconnectGoogle(schoolId);
  }

  @Post('google/sync')
  async syncToGoogle(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId?: string,
  ) {
    return this.calendarSyncService.syncToGoogle(schoolId, classId);
  }

  @Get('sync-status')
  async getSyncStatus(@Query('schoolId') schoolId: string) {
    return this.calendarSyncService.getSyncStatus(schoolId);
  }

  @Get('export/ical')
  async exportToIcal(
    @Query('schoolId') schoolId: string,
    @Query('classId') classId: string,
    @Query('teacherId') teacherId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.calendarSyncService.exportToIcal(schoolId, classId, teacherId);
    res.set({
      'Content-Type': 'text/calendar',
      'Content-Disposition': `attachment; filename="timetable.ics"`,
    });
    res.send(buffer);
  }
}
