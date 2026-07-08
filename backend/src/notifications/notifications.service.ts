import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationQueueService, NotificationJobData } from './notification-queue.service';
import { SendNotificationDto, BroadcastNotificationDto } from './dto/send-notification.dto';
import { StudentFilterService } from '../common/services/student-filter.service';
import type { Message } from 'firebase-admin/messaging';

const VALID_CATEGORIES = [
  'Academic',
  'Attendance',
  'Finance',
  'Communication',
  'AI Insights',
  'System Notifications',
];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private firebase: FirebaseService,
    private queue: NotificationQueueService,
    private studentFilter: StudentFilterService,
  ) {}

  validateCategory(category: string): string {
    if (VALID_CATEGORIES.includes(category)) return category;
    return 'System Notifications';
  }

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    createdBy?: string,
    delay?: number,
  ): Promise<string | null> {
    const jobData: NotificationJobData = {
      type: 'single',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      userId,
      createdBy,
    };

    return this.queue.enqueueNotification(jobData, delay);
  }

  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    createdBy?: string,
  ): Promise<string | null> {
    const jobData: NotificationJobData = {
      type: 'multi',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      userIds,
      createdBy,
    };

    return this.queue.enqueueNotification(jobData);
  }

  async sendByRole(
    role: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    schoolId?: string,
    createdBy?: string,
  ): Promise<string | null> {
    const where: any = {
      userRoles: { some: { role: { name: role } } },
    };
    if (schoolId) where.schoolId = schoolId;

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    const jobData: NotificationJobData = {
      type: 'role',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      userIds: users.map(u => u.id),
      role,
      schoolId,
      createdBy,
    };

    return this.queue.enqueueNotification(jobData);
  }

  async sendToClass(
    classId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    createdBy?: string,
  ): Promise<string | null> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId,
        status: 'ACTIVE',
        student: this.studentFilter.communicationRecipientWhere(),
      },
      include: { student: { include: { user: { select: { id: true } } } } },
    });

    const userIds = enrollments
      .map(e => e.student?.user?.id)
      .filter(Boolean);

    const teacherAssignments = await this.prisma.teachingAssignment.findMany({
      where: { classId },
      include: { teacher: { include: { user: { select: { id: true } } } } },
    });

    const teacherIds = teacherAssignments
      .map(ta => ta.teacher?.user?.id)
      .filter(Boolean);

    const jobData: NotificationJobData = {
      type: 'class',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      userIds: [...userIds, ...teacherIds],
      classId,
      createdBy,
    };

    return this.queue.enqueueNotification(jobData);
  }

  async sendToSchool(
    schoolId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    createdBy?: string,
    delay?: number,
  ): Promise<string | null> {
    const jobData: NotificationJobData = {
      type: 'school',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      schoolId,
      createdBy,
    };

    return this.queue.enqueueNotification(jobData, delay);
  }

  async sendToSchools(
    schoolIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    createdBy?: string,
  ): Promise<string | null> {
    const jobData: NotificationJobData = {
      type: 'school',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      schoolIds,
      createdBy,
    };

    return this.queue.enqueueNotification(jobData);
  }

  async sendToPlatform(
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string,
    createdBy?: string,
  ): Promise<string | null> {
    const jobData: NotificationJobData = {
      type: 'platform',
      title,
      body,
      data,
      category: this.validateCategory(category || 'System Notifications'),
      createdBy,
    };

    return this.queue.enqueueNotification(jobData);
  }

  async processJob(jobData: NotificationJobData): Promise<void> {
    this.logger.log(`Processing notification job type=${jobData.type}`);

    let userIds: string[] = [];

    switch (jobData.type) {
      case 'single':
        if (jobData.userId) userIds = [jobData.userId];
        break;
      case 'multi':
      case 'role':
        userIds = jobData.userIds || [];
        break;
      case 'class':
        userIds = jobData.userIds || [];
        break;
      case 'school':
        if (jobData.schoolIds?.length) {
          for (const sid of jobData.schoolIds) {
            const schoolUsers = await this.prisma.user.findMany({
              where: { schoolId: sid, isActive: true },
              select: { id: true },
            });
            userIds.push(...schoolUsers.map(u => u.id));
          }
        } else if (jobData.schoolId) {
          const schoolUsers = await this.prisma.user.findMany({
            where: { schoolId: jobData.schoolId, isActive: true },
            select: { id: true },
          });
          userIds.push(...schoolUsers.map(u => u.id));
        }
        break;
      case 'platform':
        const allUsers = await this.prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        });
        userIds = allUsers.map(u => u.id);
        break;
    }

    if (userIds.length === 0) {
      this.logger.warn('No target users for notification job');
      return;
    }

    for (const userId of userIds) {
      await this.sendViaFcm(userId, {
        title: jobData.title,
        body: jobData.body,
        data: jobData.data || {},
        category: jobData.category || 'System Notifications',
      });
    }
  }

  private async sendViaFcm(
    userId: string,
    payload: {
      title: string;
      body: string;
      data: Record<string, string>;
      category: string;
    },
  ): Promise<void> {
    const devices = await this.prisma.notificationDevice.findMany({
      where: { userId, active: true },
    });

    if (devices.length === 0) {
      this.logger.warn(`No active NotificationDevice for user ${userId}`);
      return;
    }

    const now = new Date();
    await this.prisma.notification.create({
      data: {
        userId,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        type: payload.data?.type || 'general',
        category: payload.category,
        status: 'sent',
        sentAt: now,
      },
    });

    if (!this.firebase.messaging) {
      this.logger.warn('Firebase not initialized, notification stored but not pushed');
      return;
    }

    for (const device of devices) {
      try {
        const message: Message = {
          token: device.deviceToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data,
          android: {
            priority: 'high',
            notification: {
              channelId: 'smart_tech_notifications',
              priority: 'high',
              color: '#1E3A8A',
            },
          },
        };

        const result = await this.firebase.messaging.send(message);
        this.logger.log(`FCM sent to ${device.deviceToken.substring(0, 20)}...: ${result}`);

        await this.prisma.notificationDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now },
        });
      } catch (error) {
        this.logger.error(`FCM send failed for ${device.deviceToken.substring(0, 20)}...: ${error.message}`);

        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/unregistered'
        ) {
          await this.prisma.notificationDevice.update({
            where: { id: device.id },
            data: { active: false },
          });
        }
      }
    }
  }

  async handleDeliveryReceipt(token: string, status: 'delivered' | 'opened'): Promise<void> {
    const device = await this.prisma.notificationDevice.findFirst({
      where: { deviceToken: token },
    });

    if (device) {
      await this.prisma.notificationDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    }
  }

  async getNotifications(
    userId: string,
    page = 1,
    limit = 20,
    category?: string,
  ) {
    const where: any = { userId };
    if (category) where.category = category;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
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

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getAnalytics(startDate?: string, endDate?: string, category?: string) {
    const where: any = {};
    if (startDate) where.createdAt = { ...(where.createdAt || {}), gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };
    if (category) where.category = category;

    const [total, sentCount, deliveredCount, openedCount, failedCount, byCategory, byDay] =
      await Promise.all([
        this.prisma.notification.count({ where }),
        this.prisma.notification.count({ where: { ...where, status: 'sent' } }),
        this.prisma.notification.count({ where: { ...where, status: 'delivered' } }),
        this.prisma.notification.count({ where: { ...where, openedAt: { not: null } } }),
        this.prisma.notification.count({ where: { ...where, status: 'failed' } }),
        this.prisma.notification.groupBy({
          by: ['category'],
          where,
          _count: { id: true },
        }),
        this.prisma.notification.groupBy({
          by: ['createdAt'],
          where,
          _count: { id: true },
        }),
      ]);

    return {
      total,
      sent: sentCount,
      delivered: deliveredCount,
      opened: openedCount,
      failed: failedCount,
      rate: total > 0 ? Math.round((deliveredCount / total) * 100) : 0,
      byCategory,
    };
  }

  async registerDevice(
    userId: string,
    deviceToken: string,
    platform?: string,
    role?: string,
  ): Promise<void> {
    await this.prisma.notificationDevice.upsert({
      where: {
        userId_deviceToken: { userId, deviceToken },
      },
      update: {
        active: true,
        platform: platform || 'android',
        role: role || undefined,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        deviceToken,
        platform: platform || 'android',
        role: role || undefined,
        active: true,
        lastSeenAt: new Date(),
      },
    });
  }

  async removeDevice(userId: string, deviceToken: string): Promise<void> {
    await this.prisma.notificationDevice.updateMany({
      where: { userId, deviceToken },
      data: { active: false },
    });
  }

  async sendTestNotification(token?: string): Promise<string> {
    if (token) {
      if (!this.firebase.messaging) {
        return 'Firebase not initialized. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars.';
      }

      try {
        const result = await this.firebase.messaging.send({
          token,
          notification: {
            title: 'SmartTech Test',
            body: 'This is a test notification from SmartTech.',
          },
          data: { type: 'test' },
          android: { priority: 'high' },
        });
        return `Test sent successfully: ${result}`;
      } catch (error) {
        return `Test failed: ${error.message}`;
      }
    }

    return 'Token required. Send a push token to test with.';
  }

  async getCategories() {
    return { categories: VALID_CATEGORIES };
  }

  getQueueStats() {
    return this.queue.getQueueStats();
  }

  async broadcast(dto: BroadcastNotificationDto, createdBy: string): Promise<{ jobId: string | null; targetCount: number }> {
    const jobData: NotificationJobData = {
      type: dto.target === 'all' ? 'platform' : dto.target === 'schools' ? 'school' : 'multi',
      title: dto.title,
      body: dto.body,
      data: dto.data,
      category: this.validateCategory(dto.category || 'System Notifications'),
      schoolIds: dto.schoolIds,
      userIds: dto.userIds,
      createdBy,
    };

    const delay = dto.scheduleAt ? new Date(dto.scheduleAt).getTime() - Date.now() : 0;
    const jobId = await this.queue.enqueueNotification(jobData, delay > 0 ? delay : undefined);

    let targetCount = 0;
    if (dto.target === 'all') {
      targetCount = await this.prisma.user.count({ where: { isActive: true } });
    } else if (dto.target === 'schools' && dto.schoolIds?.length) {
      targetCount = await this.prisma.user.count({
        where: { schoolId: { in: dto.schoolIds }, isActive: true },
      });
    } else if (dto.target === 'users' && dto.userIds?.length) {
      targetCount = dto.userIds.length;
    }

    return { jobId, targetCount };
  }

  async send(dto: SendNotificationDto, createdBy?: string): Promise<{ jobId: string | null }> {
    if (dto.userIds?.length) {
      const jobId = await this.sendToUsers(dto.userIds, dto.title, dto.body, dto.data, dto.category, createdBy);
      return { jobId };
    }
    if (dto.role) {
      const jobId = await this.sendByRole(dto.role, dto.title, dto.body, dto.data, dto.category, dto.schoolId, createdBy);
      return { jobId };
    }
    if (dto.classId) {
      const jobId = await this.sendToClass(dto.classId, dto.title, dto.body, dto.data, dto.category, createdBy);
      return { jobId };
    }
    if (dto.grade) {
      const classes = await this.prisma.class.findMany({
        where: { levelType: { name: dto.grade }, schoolId: dto.schoolId },
        select: { id: true },
      });
      const classIds = classes.map(c => c.id);
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          classId: { in: classIds },
          status: 'ACTIVE',
          student: this.studentFilter.communicationRecipientWhere(),
        },
        include: { student: { include: { user: { select: { id: true } } } } },
      });
      const userIds = enrollments.map(e => e.student?.user?.id).filter(Boolean);
      const jobId = await this.sendToUsers(userIds, dto.title, dto.body, dto.data, dto.category, createdBy);
      return { jobId };
    }
    if (dto.schoolId) {
      const jobId = await this.sendToSchool(dto.schoolId, dto.title, dto.body, dto.data, dto.category, createdBy, dto.scheduleAt ? new Date(dto.scheduleAt).getTime() - Date.now() : undefined);
      return { jobId };
    }
    if (dto.schoolIds?.length) {
      const jobId = await this.sendToSchools(dto.schoolIds, dto.title, dto.body, dto.data, dto.category, createdBy);
      return { jobId };
    }
    return { jobId: null };
  }
}
