export class SendNotificationDto {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: string;
  userIds?: string[];
  role?: string;
  classId?: string;
  grade?: string;
  schoolId?: string;
  schoolIds?: string[];
  scheduleAt?: string;
}

export class BroadcastNotificationDto {
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: string;
  target: 'all' | 'schools' | 'users';
  schoolIds?: string[];
  userIds?: string[];
  scheduleAt?: string;
}

export class TestNotificationDto {
  token?: string;
  title?: string;
  body?: string;
}

export class NotificationAnalyticsQueryDto {
  startDate?: string;
  endDate?: string;
  category?: string;
}

export class MarkReadDto {
  notificationId: string;
}
