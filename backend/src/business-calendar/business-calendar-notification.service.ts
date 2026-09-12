import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsCloudService } from '../communications-cloud/communications-cloud.service';

@Injectable()
export class BusinessCalendarNotificationService {
  private readonly logger = new Logger(BusinessCalendarNotificationService.name);
  constructor(private readonly prisma: PrismaService, private readonly communications: CommunicationsCloudService) {}

  @Cron('*/15 * * * *')
  async processDueReminders() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
    const activities = await this.prisma.calendarActivity.findMany({ where: { startDate: { gte: now, lte: horizon }, status: { notIn: ['COMPLETED', 'CANCELLED'] }, reminderMinutes: { not: null } }, include: { calendar: true, audiences: true } });
    for (const activity of activities) {
      const configured = Array.isArray(activity.reminderMinutes) ? activity.reminderMinutes : [];
      for (const minutes of configured) await this.sendReminder(activity, Number(minutes));
    }
  }

  private async sendReminder(activity: any, minutes: number) {
    if (!Number.isFinite(minutes) || minutes < 0) return;
    const target = new Date(activity.startDate).getTime() - minutes * 60 * 1000;
    if (target > Date.now() || target < Date.now() - 15 * 60 * 1000) return;
    const reminderType = minutes >= 10000 ? 'WEEK_BEFORE' : minutes >= 1200 ? 'DAY_BEFORE' : `CUSTOM_${minutes}`;
    const recipients = await this.recipients(activity);
    for (const recipient of recipients) {
      const key = `${activity.schoolId}:${activity.id}:${recipient.id}:${reminderType}:${activity.calendar.version}`;
      try {
        await this.prisma.calendarNotificationDelivery.create({ data: { schoolId: activity.schoolId, activityId: activity.id, recipientId: recipient.id, calendarVersion: activity.calendar.version, reminderType, channel: 'SMS', idempotencyKey: key } });
      } catch { continue; }
      const message = `SMART_TECH SCHOOL CALENDAR\nReminder: ${activity.title}\nDate: ${new Date(activity.startDate).toLocaleDateString('en-GB')}\nTime: ${activity.startTime || 'All day'}${activity.venue ? `\nVenue: ${activity.venue}` : ''}`;
      try {
        await this.communications.sendSms({ recipient: recipient.phone, message, schoolId: activity.schoolId, userId: recipient.id, messageType: 'calendar-reminder', metadata: { activityId: activity.id, reminderType, calendarVersion: activity.calendar.version } } as any);
        await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { status: 'SENT', sentAt: new Date() } });
      } catch (error: any) {
        if (recipient.email) {
          try {
            await this.communications.sendEmail({ recipient: recipient.email, subject: `School calendar reminder: ${activity.title}`, body: message, schoolId: activity.schoolId, metadata: { activityId: activity.id, reminderType, fallbackFrom: 'SMS', calendarVersion: activity.calendar.version } } as any);
            await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { channel: 'EMAIL_FALLBACK', status: 'SENT', sentAt: new Date(), lastError: String(error?.message || 'SMS provider failed; email fallback used') } });
            continue;
          } catch (emailError: any) {
            error = emailError;
          }
        }
        await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { status: 'FAILED', lastError: String(error?.message || 'School SMS provider failed') } });
        this.logger.warn(`Calendar SMS failed for school ${activity.schoolId}: ${error?.message || 'provider error'}`);
      }
    }
  }

  async notifyChange(activityId: string, type: 'UPDATED' | 'CANCELLED') {
    const activity = await this.prisma.calendarActivity.findUnique({ where: { id: activityId }, include: { calendar: true, audiences: true } });
    if (!activity) return;
    const recipients = await this.recipients(activity);
    for (const recipient of recipients) {
      const key = `${activity.schoolId}:${activity.id}:${recipient.id}:CHANGE_${type}:${activity.calendar.version}`;
      try { await this.prisma.calendarNotificationDelivery.create({ data: { schoolId: activity.schoolId, activityId: activity.id, recipientId: recipient.id, calendarVersion: activity.calendar.version, reminderType: `CHANGE_${type}`, channel: 'SMS', idempotencyKey: key } }); } catch { continue; }
      const message = `SMART_TECH CALENDAR UPDATE\n${activity.title} has been ${type === 'CANCELLED' ? 'cancelled' : 'updated'}.\nDate: ${new Date(activity.startDate).toLocaleDateString('en-GB')}\nTime: ${activity.startTime || 'All day'}${activity.venue ? `\nVenue: ${activity.venue}` : ''}`;
      try { await this.communications.sendSms({ recipient: recipient.phone, message, schoolId: activity.schoolId, userId: recipient.id, messageType: 'calendar-change', metadata: { activityId: activity.id, changeType: type, calendarVersion: activity.calendar.version } } as any); await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { status: 'SENT', sentAt: new Date() } }); } catch (error: any) { if (recipient.email) { try { await this.communications.sendEmail({ recipient: recipient.email, subject: `School calendar ${type === 'CANCELLED' ? 'cancellation' : 'update'}: ${activity.title}`, body: message, schoolId: activity.schoolId, metadata: { activityId: activity.id, fallbackFrom: 'SMS', calendarVersion: activity.calendar.version } } as any); await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { channel: 'EMAIL_FALLBACK', status: 'SENT', sentAt: new Date(), lastError: String(error?.message || 'SMS failed; email fallback used') } }); continue; } catch (emailError: any) { error = emailError; } } await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { status: 'FAILED', lastError: String(error?.message || 'School SMS provider failed') } }); }
    }
  }

  private async recipients(activity: any) {
    const audience = activity.audiences || [];
    const userIds = audience.filter((item: any) => item.type === 'USER' && item.userId).map((item: any) => item.userId);
    const departmentIds = audience.filter((item: any) => item.type === 'DEPARTMENT' && item.departmentId).map((item: any) => item.departmentId);
    return this.prisma.user.findMany({ where: { schoolId: activity.schoolId, isActive: true, phone: { not: null }, ...(userIds.length ? { id: { in: userIds } } : departmentIds.length ? { departmentAssignments: { some: { departmentId: { in: departmentIds }, isActive: true } } } : {}) }, select: { id: true, phone: true, email: true } });
  }
}
