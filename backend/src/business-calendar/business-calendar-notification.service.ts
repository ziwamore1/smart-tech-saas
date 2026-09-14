import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsCloudService } from '../communications-cloud/communications-cloud.service';

const SMS_NIGHT_CUTOFF_HOUR = 20;

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
      if (!this.isExplicitDateActivity(activity)) continue;
      if (this.afterNightCutoff(activity)) continue;
      const configured = Array.isArray(activity.reminderMinutes) ? activity.reminderMinutes : [];
      for (const minutes of configured) await this.sendReminder(activity, Number(minutes));
    }
  }

  private async sendReminder(activity: any, minutes: number) {
    if (!Number.isFinite(minutes) || minutes < 0) return;
    if (this.afterNightCutoff(activity)) return;
    const target = new Date(activity.startDate).getTime() - minutes * 60 * 1000;
    if (target > Date.now() || target < Date.now() - 15 * 60 * 1000) return;
    const reminderType = minutes >= 10000 ? 'WEEK_BEFORE' : minutes >= 1200 ? 'DAY_BEFORE' : `CUSTOM_${minutes}`;
    const message = `SMART_TECH SCHOOL CALENDAR\nReminder: ${activity.title}\nDate: ${new Date(activity.startDate).toLocaleDateString('en-GB')}\nTime: ${activity.startTime || 'All day'}${activity.venue ? `\nVenue: ${activity.venue}` : ''}`;
    const htmlBody = this.buildCalendarEmailHtml(activity, 'reminder');
    const recipients = await this.recipients(activity);
    for (const recipient of recipients) {
      await this.sendCalendarSms(activity, recipient, reminderType, message, `School calendar reminder: ${activity.title}`, 'calendar-reminder', { activityId: activity.id, reminderType, calendarVersion: activity.calendar?.version ?? 1 }, htmlBody);
    }
  }

  async notifyChange(activityId: string, type: 'UPDATED' | 'CANCELLED') {
    const activity = await this.prisma.calendarActivity.findUnique({ where: { id: activityId }, include: { calendar: true, audiences: true } });
    if (!activity) return;
    if (!this.isExplicitDateActivity(activity)) return;
    if (this.afterNightCutoff(activity)) return;
    const recipients = await this.recipients(activity);
    const message = `SMART_TECH CALENDAR UPDATE\n${activity.title} has been ${type === 'CANCELLED' ? 'cancelled' : 'updated'}.\nDate: ${new Date(activity.startDate).toLocaleDateString('en-GB')}\nTime: ${activity.startTime || 'All day'}${activity.venue ? `\nVenue: ${activity.venue}` : ''}`;
    const htmlBody = this.buildCalendarEmailHtml(activity, type === 'CANCELLED' ? 'cancelled' : 'updated');
    for (const recipient of recipients) {
      await this.sendCalendarSms(activity, recipient, `CHANGE_${type}`, message, `School calendar ${type === 'CANCELLED' ? 'cancellation' : 'update'}: ${activity.title}`, 'calendar-change', { activityId: activity.id, changeType: type, calendarVersion: activity.calendar?.version ?? 1 }, htmlBody);
    }
  }

  private readonly broadcastRoles = ['DIRECTOR', 'DEPUTY DIRECTOR', 'HEAD TEACHER', 'DEPUTY HEAD', 'DEPUTY', 'HOD', 'TEACHER', 'CLASS TEACHER'];

  private async recipients(activity: any) {
    const audience = activity.audiences || [];
    const userIds = audience.filter((item: any) => item.type === 'USER' && item.userId).map((item: any) => item.userId);
    const departmentIds = audience.filter((item: any) => item.type === 'DEPARTMENT' && item.departmentId).map((item: any) => item.departmentId);
    const restrictedTypes = audience.filter((item: any) => item.type === 'STUDENTS' || item.type === 'PARENTS').map((item: any) => item.type);
    if (restrictedTypes.length) {
      this.logger.warn(`Calendar alert for activity ${activity.id} targets non-staff audience (${restrictedTypes.join(',')}); skipped by broadcast policy`);
      return [];
    }
    const where: any = {
      schoolId: activity.schoolId,
      isActive: true,
      OR: [{ phone: { not: null } }, { email: { not: '' } }],
    };
    if (userIds.length) {
      where.id = { in: userIds };
    } else if (departmentIds.length) {
      where.departmentAssignments = { some: { departmentId: { in: departmentIds }, isActive: true } };
      where.userRoles = { some: { role: { name: { in: this.broadcastRoles, mode: 'insensitive' } } } };
    } else {
      where.userRoles = { some: { role: { name: { in: this.broadcastRoles, mode: 'insensitive' } } } };
    }
    return this.prisma.user.findMany({ where, select: { id: true, phone: true, email: true } });
  }

  private async sendCalendarSms(
    activity: any,
    recipient: { id: string; phone: string | null; email: string | null },
    reminderType: string,
    message: string,
    subject: string,
    messageType: string,
    metadata: Record<string, unknown>,
    htmlBody?: string,
  ) {
    const key = `${activity.schoolId}:${activity.id}:${recipient.id}:${reminderType}:${activity.calendar?.version ?? 1}`;
    try {
      await this.prisma.calendarNotificationDelivery.create({ data: { schoolId: activity.schoolId, activityId: activity.id, recipientId: recipient.id, calendarVersion: activity.calendar?.version ?? 1, reminderType, channel: 'SMS', idempotencyKey: key } });
    } catch {
      return;
    }

    try {
      if (recipient.phone) {
        await this.communications.sendSms({ recipient: recipient.phone, message, schoolId: activity.schoolId, userId: recipient.id, messageType, metadata } as any);
        await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { status: 'SENT', sentAt: new Date() } });
        return;
      }
      throw new Error('Recipient has no SMS phone number');
    } catch (error: any) {
      if (recipient.email) {
        try {
          await this.communications.sendEmail({ recipient: recipient.email, subject, body: message, htmlBody, schoolId: activity.schoolId, metadata: { ...metadata, fallbackFrom: 'SMS' } } as any);
          await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { channel: 'EMAIL_FALLBACK', status: 'SENT', sentAt: new Date(), lastError: String(error?.message || 'SMS provider failed; email fallback used') } });
          return;
        } catch (emailError: any) {
          error = emailError;
        }
      }
      await this.prisma.calendarNotificationDelivery.update({ where: { idempotencyKey: key }, data: { status: 'FAILED', lastError: String(error?.message || 'School SMS provider failed') } }).catch(() => undefined);
      this.logger.warn(`Calendar SMS failed for school ${activity.schoolId}: ${error?.message || 'provider error'}`);
    }
  }

  private isExplicitDateActivity(activity: any): boolean {
    const start = activity?.startDate ? new Date(activity.startDate) : null;
    if (!start) return false;
    const end = activity?.endDate ? new Date(activity.endDate) : start;
    return start.getUTCFullYear() === end.getUTCFullYear()
      && start.getUTCMonth() === end.getUTCMonth()
      && start.getUTCDate() === end.getUTCDate();
  }

  private afterNightCutoff(activity: any): boolean {
    const tz = String(activity?.calendar?.timezone || 'UTC');
    let localHour: number;
    try {
      localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    } catch {
      localHour = new Date().getHours();
    }
    return localHour >= SMS_NIGHT_CUTOFF_HOUR;
  }

  private buildCalendarEmailHtml(activity: any, kind: 'reminder' | 'updated' | 'cancelled'): string {
    const safe = (value: unknown) => this.escapeHtml(value);
    const title = safe(activity?.title || 'Calendar Activity');
    const dateLabel = safe(new Date(activity.startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }));
    const timeLabel = safe(activity?.startTime || 'All day');
    const venue = activity?.venue ? safe(String(activity.venue)) : '';

    const heading = kind === 'cancelled' ? 'Meeting Cancelled' : kind === 'updated' ? 'Meeting Update' : 'Meeting Reminder';
    const intro = kind === 'reminder'
      ? 'This is a reminder for the following school calendar activity.'
      : kind === 'cancelled' ? 'This activity has been cancelled.'
      : 'The details of this activity have been updated.';
    const accent = kind === 'cancelled' ? '#dc2626' : '#2563eb';
    const accentBg = kind === 'cancelled' ? '#fee2e2' : '#eff6ff';
    const barColor = kind === 'cancelled' ? '#f87171' : '#38bdf8';

    return `<!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f8;padding:40px 20px;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e40af 50%, #2563eb 100%); padding:36px 30px; border-radius:16px 16px 0 0; text-align:center;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                    <tr>
                      <td style="width:46px;height:46px;background:#2563eb;border-radius:12px;text-align:center;vertical-align:middle;font-size:23px;color:#fff;font-weight:700;line-height:46px;">ST</td>
                      <td style="padding-left:14px;">
                        <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Smart Tech</div>
                        <div style="color:#93c5fd;font-size:12px;font-weight:400;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">School Calendar</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="height:4px;background:linear-gradient(90deg,${accent},${barColor},${accent});"></td>
              </tr>

              <tr>
                <td style="background:#ffffff;padding:36px 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${accentBg};border:1px solid #bfdbfe;border-radius:10px;margin-bottom:24px;">
                    <tr>
                      <td style="padding:16px 20px;">
                        <div style="color:${accent};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">${heading}</div>
                        <div style="color:#0f172a;font-size:19px;font-weight:700;">${title}</div>
                        <div style="color:#475569;font-size:13px;margin-top:6px;">${intro}</div>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px;">
                    <tr>
                      <td style="background:${accent};padding:12px 20px;">
                        <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Activity Details</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:16px 20px;">
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:8px 0;width:110px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Date</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${dateLabel}</td>
                          </tr>
                          <tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:8px 0;width:110px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Time</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${timeLabel}</td>
                          </tr>
                          ${venue ? `<tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr>
                          <tr>
                            <td style="padding:8px 0;width:110px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Venue</td>
                            <td style="padding:8px 0;color:#0f172a;font-size:14px;font-weight:600;">${venue}</td>
                          </tr>` : ''}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="background:#f8fafc;padding:24px 32px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom:10px;">
                        <span style="font-size:14px;font-weight:700;color:#1e40af;">Smart Tech</span>
                        <span style="color:#cbd5e1;padding:0 8px;">|</span>
                        <span style="font-size:12px;color:#94a3b8;">Education Management Platform</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="font-size:12px;color:#94a3b8;line-height:1.6;">
                        This is an automated notice from the school business calendar. Please do not reply to this email.<br>
                        If you did not expect this email, contact your school administrator.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td></tr>
        </table>
      </body>
      </html>`;
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, (char) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
    )[char] || char);
  }
}