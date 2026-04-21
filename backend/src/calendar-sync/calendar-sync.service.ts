import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

@Injectable()
export class CalendarSyncService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private getOAuth2Client() {
    return new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI') || 'http://localhost:3001/api/v1/calendar/google/callback',
    );
  }

  async getGoogleAuthUrl(schoolId: string) {
    const oauth2Client = this.getOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: schoolId,
    });

    return { authUrl: url };
  }

  async googleCallback(schoolId: string, code: string) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const { data: profile } = await calendar.calendarList.list();

    const primaryCalendar = profile.items?.find(c => c.primary);

    await this.prisma.calendarSync.upsert({
      where: {
        schoolId_provider: {
          schoolId,
          provider: 'google',
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
        googleEmail: primaryCalendar?.summary || undefined,
        lastSyncAt: new Date(),
      },
      create: {
        schoolId,
        provider: 'google',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
        googleEmail: primaryCalendar?.summary || undefined,
        lastSyncAt: new Date(),
      },
    });

    return { success: true };
  }

  async getGoogleStatus(schoolId: string) {
    const sync = await this.prisma.calendarSync.findUnique({
      where: {
        schoolId_provider: {
          schoolId,
          provider: 'google',
        },
      },
    });

    return {
      googleConnected: sync?.isActive || false,
      googleEmail: sync?.googleEmail,
      lastSync: sync?.lastSyncAt,
    };
  }

  async disconnectGoogle(schoolId: string) {
    await this.prisma.calendarSync.updateMany({
      where: {
        schoolId,
        provider: 'google',
      },
      data: {
        isActive: false,
      },
    });

    return { success: true };
  }

  async syncToGoogle(schoolId: string, classId?: string) {
    const sync = await this.prisma.calendarSync.findUnique({
      where: {
        schoolId_provider: {
          schoolId,
          provider: 'google',
        },
      },
    });

    if (!sync?.isActive || !sync.accessToken) {
      throw new Error('Google Calendar not connected');
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: sync.accessToken,
      refresh_token: sync.refreshToken,
      expiry_date: sync.expiryDate?.getTime(),
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const whereClause: any = { schoolId };
    if (classId) whereClause.classId = classId;

    const timetables = await this.prisma.timetable.findMany({
      where: whereClause,
      include: {
        class: true,
        slots: {
          include: {
            subject: true,
            teacher: { include: { user: true } },
            classroom: true,
          },
        },
      },
    });

    for (const timetable of timetables) {
      for (const slot of timetable.slots) {
        const startDate = this.getDateForDayAndPeriod(slot.day, slot.period, 'start');
        const endDate = this.getDateForDayAndPeriod(slot.day, slot.period, 'end');

        await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: `${slot.subject.name} - ${timetable.class.name}`,
            description: `Teacher: ${slot.teacher.user.firstName} ${slot.teacher.user.lastName}\nRoom: ${slot.classroom?.name || 'TBA'}`,
            location: slot.classroom?.name,
            start: { dateTime: startDate.toISOString() },
            end: { dateTime: endDate.toISOString() },
            recurrence: ['RRULE:FREQ=WEEKLY'],
          },
        });
      }
    }

    await this.prisma.calendarSync.update({
      where: {
        schoolId_provider: {
          schoolId,
          provider: 'google',
        },
      },
      data: {
        lastSyncAt: new Date(),
        syncedClasses: classId ? [...(sync.syncedClasses as string[]), classId] : [],
      },
    });

    return { success: true, eventsCreated: timetables.reduce((sum, t) => sum + t.slots.length, 0) };
  }

  async getSyncStatus(schoolId: string) {
    const syncs = await this.prisma.calendarSync.findMany({
      where: { schoolId },
    });

    return {
      google: syncs.find(s => s.provider === 'google'),
      syncedClasses: syncs.flatMap(s => s.syncedClasses as string[]),
    };
  }

  async exportToIcal(schoolId: string, classId?: string, teacherId?: string) {
    const whereClause: any = { schoolId };
    if (classId) whereClause.classId = classId;

    const timetables = await this.prisma.timetable.findMany({
      where: whereClause,
      include: {
        class: true,
        slots: {
          include: {
            subject: true,
            teacher: { include: { user: true } },
            classroom: true,
          },
        },
      },
    });

    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Smart Tech SaaS//Timetable//EN\r\n';

    for (const timetable of timetables) {
      for (const slot of timetable.slots) {
        if (teacherId && slot.teacherId !== teacherId) continue;

        const startDate = this.getDateForDayAndPeriod(slot.day, slot.period, 'start');
        const endDate = this.getDateForDayAndPeriod(slot.day, slot.period, 'end');

        ics += 'BEGIN:VEVENT\r\n';
        ics += `DTSTART:${this.formatDate(startDate)}\r\n`;
        ics += `DTEND:${this.formatDate(endDate)}\r\n`;
        ics += `SUMMARY:${slot.subject.name} - ${timetable.class.name}\r\n`;
        ics += `DESCRIPTION:Teacher: ${slot.teacher.user.firstName} ${slot.teacher.user.lastName}\\nRoom: ${slot.classroom?.name || 'TBA'}\r\n`;
        ics += `LOCATION:${slot.classroom?.name || ''}\r\n`;
        ics += `RRULE:FREQ=WEEKLY;BYDAY=${['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][slot.day - 1]}\r\n`;
        ics += 'END:VEVENT\r\n';
      }
    }

    ics += 'END:VCALENDAR';

    return Buffer.from(ics);
  }

  private getDateForDayAndPeriod(day: number, period: number, type: 'start' | 'end') {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    monday.setHours(0, 0, 0, 0);

    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + day - 1);

    const periodTimes: Record<number, { start: [number, number]; end: [number, number] }> = {
      1: { start: [7, 30], end: [8, 20] },
      2: { start: [8, 20], end: [9, 10] },
      3: { start: [9, 10], end: [10, 0] },
      4: { start: [10, 0], end: [10, 50] },
      5: { start: [10, 50], end: [11, 40] },
      6: { start: [11, 40], end: [12, 30] },
      7: { start: [12, 30], end: [13, 20] },
      8: { start: [13, 20], end: [14, 10] },
      9: { start: [14, 10], end: [15, 0] },
      10: { start: [15, 0], end: [15, 50] },
    };

    const times = periodTimes[period] || { start: [8, 0], end: [8, 50] };
    targetDate.setHours(times[type][0], times[type][1], 0, 0);

    return targetDate;
  }

  private formatDate(date: Date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
}
