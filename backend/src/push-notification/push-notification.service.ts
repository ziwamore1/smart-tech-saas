import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseService,
    private notificationsService: NotificationsService,
  ) {}

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string = 'android',
    deviceId?: string,
    role?: string,
  ): Promise<void> {
    this.logger.log(`Registering device token for user: ${userId}`);

    await this.prisma.deviceToken.upsert({
      where: {
        userId_token: { userId, token },
      },
      update: {
        isActive: true,
        platform,
        deviceId,
        updatedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        deviceId,
        isActive: true,
      },
    });

    await this.notificationsService.registerDevice(userId, token, platform, role);

    this.logger.log(`Device token registered successfully for user: ${userId}`);
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.updateMany({
      where: { userId, token },
      data: { isActive: false },
    });

    await this.notificationsService.removeDevice(userId, token);
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    role?: string,
  ): Promise<boolean> {
    const jobId = await this.notificationsService.sendToUser(
      userId,
      payload.title,
      payload.body,
      payload.data,
      payload.data?.type === 'attendance_alert' ? 'Attendance'
        : payload.data?.type === 'result_published' ? 'Academic'
        : 'System Notifications',
    );

    return jobId !== null;
  }

  async sendToUsers(userIds: string[], payload: PushNotificationPayload, role?: string): Promise<void> {
    await this.notificationsService.sendToUsers(
      userIds,
      payload.title,
      payload.body,
      payload.data,
      'System Notifications',
    );
  }

  async sendByRole(roleName: string, payload: PushNotificationPayload, schoolId?: string): Promise<number> {
    const where: any = {
      userRoles: { some: { role: { name: roleName } } },
    };
    if (schoolId) where.schoolId = schoolId;

    const users = await this.prisma.user.findMany({ where, select: { id: true } });

    for (const user of users) {
      await this.sendToUser(user.id, payload, roleName);
    }

    return users.length;
  }

  async sendToSchool(schoolId: string, payload: PushNotificationPayload, roles?: string[]): Promise<void> {
    const jobId = await this.notificationsService.sendToSchool(
      schoolId,
      payload.title,
      payload.body,
      payload.data,
      'System Notifications',
    );
  }

  async getNotifications(userId: string, page = 1, limit = 20) {
    return this.notificationsService.getNotifications(userId, page, limit);
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationsService.markAsRead(userId, notificationId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsService.markAllAsRead(userId);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsService.getUnreadCount(userId);
  }
}
