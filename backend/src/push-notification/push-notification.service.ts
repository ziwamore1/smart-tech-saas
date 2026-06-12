import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private prisma: PrismaService) {}

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string = 'android',
    deviceId?: string,
  ): Promise<void> {
    this.logger.log(`Registering device token for user: ${userId}`);

    await this.prisma.deviceToken.upsert({
      where: {
        userId_token: {
          userId,
          token,
        },
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

    this.logger.log(`Device token registered successfully for user: ${userId}`);
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    this.logger.log(`Removing device token for user: ${userId}`);

    await this.prisma.deviceToken.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });

    this.logger.log(`Device token removed for user: ${userId}`);
  }

  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    role?: string,
  ): Promise<boolean> {
    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    if (deviceTokens.length === 0) {
      this.logger.warn(`No device tokens found for user: ${userId}`);
    }

    await this.prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        type: payload.data?.type || 'general',
        role: role || null,
      },
    });

    for (const device of deviceTokens) {
      await this.sendToDevice(device.token, payload);
    }

    return deviceTokens.length > 0;
  }

  async sendToUsers(
    userIds: string[],
    payload: PushNotificationPayload,
    role?: string,
  ): Promise<void> {
    for (const userId of userIds) {
      await this.sendToUser(userId, payload, role);
    }
  }

  async sendByRole(
    roleName: string,
    payload: PushNotificationPayload,
    schoolId?: string,
  ): Promise<number> {
    const where: any = {
      userRoles: { some: { role: { name: roleName } } },
    };
    if (schoolId) where.schoolId = schoolId;

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    for (const user of users) {
      await this.sendToUser(user.id, payload, roleName);
    }

    return users.length;
  }

  async sendToSchool(
    schoolId: string,
    payload: PushNotificationPayload,
    roles?: string[],
  ): Promise<void> {
    let users;

    if (roles && roles.length > 0) {
      users = await this.prisma.user.findMany({
        where: {
          schoolId,
          userRoles: {
            some: {
              role: {
                name: { in: roles },
              },
            },
          },
        },
        select: { id: true },
      });
    } else {
      users = await this.prisma.user.findMany({
        where: { schoolId },
        select: { id: true },
      });
    }

    for (const user of users) {
      const role = roles?.length === 1 ? roles[0] : undefined;
      await this.sendToUser(user.id, payload, role);
    }
  }

  private async sendToDevice(
    token: string,
    payload: PushNotificationPayload,
  ): Promise<void> {
    this.logger.log(
      `Sending push notification to token: ${token.substring(0, 20)}...`,
    );
    this.logger.log(`Payload: ${JSON.stringify(payload)}`);

    const fcmServerKey = process.env.FCM_SERVER_KEY;

    if (!fcmServerKey) {
      this.logger.warn(
        'FCM_SERVER_KEY not configured. Notification logged but not sent.',
      );
      return;
    }

    try {
      const response = await fetch(
        'https://fcm.googleapis.com/fcm/send',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data,
            android: {
              priority: 'high',
              notification: {
                channel_id: 'smart_tech_notifications',
                icon: 'ic_notification',
                color: '#1E3A8A',
              },
            },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`FCM request failed: ${response.status}`);
      }

      this.logger.log('Push notification sent successfully');
    } catch (error) {
      this.logger.error(
        `Failed to send push notification: ${error.message}`,
      );
    }
  }

  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
