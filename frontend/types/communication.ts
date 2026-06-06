export type CommunicationType = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'FACEBOOK' | 'YOUTUBE' | 'LINKEDIN' | 'PUSH_NOTIFICATION';

export type CommunicationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SCHEDULED';

export interface Communication {
  id: string;
  type: CommunicationType;
  status: CommunicationStatus;
  subject?: string;
  message: string;
  recipientType?: 'student' | 'parent' | 'teacher' | 'director' | 'all';
  recipientIds: string[];
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  metadata?: any;
  errorMessage?: string;
  retryCount: number;
  schoolId: string;
  createdById?: string;
  communicationLogs: CommunicationLog[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationLog {
  id: string;
  communicationId: string;
  action: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  details?: any;
  recipientId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  timestamp: string;
}

export interface CommunicationSettings {
  id: string;
  schoolId: string;
  smsProvider?: string;
  smsApiKey?: string;
  smsApiSecret?: string;
  smsSenderId?: string;
  smsEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  emailEnabled: boolean;
  whatsappApiKey?: string;
  whatsappPhoneId?: string;
  whatsappEnabled: boolean;
  facebookPageId?: string;
  facebookAccessToken?: string;
  facebookEnabled: boolean;
  youtubeChannelId?: string;
  youtubeApiKey?: string;
  youtubeEnabled: boolean;
  linkedinPageId?: string;
  linkedinAccessToken?: string;
  linkedinEnabled: boolean;
  fcmServerKey?: string;
  pushEnabled: boolean;
}

export interface CommunicationStats {
  total: number;
  byType: Array<{ type: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  recentActivity: Array<{
    id: string;
    type: string;
    status: string;
    subject?: string;
    createdAt: string;
    sentAt?: string;
  }>;
}

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: CommunicationType;
  subject?: string;
  message: string;
}

export interface PlatformAnalytics {
  platform: string;
  overview: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    deliveryRate: number;
    failureRate: number;
  };
  recentPosts: Array<{
    id: string;
    message: string;
    status: CommunicationStatus;
    createdAt: string;
    sentAt?: string;
  }>;
  engagement: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    impressions?: number;
    clicks?: number;
    engagementRate?: number;
    delivered?: number;
    read?: number;
    responseRate?: number;
  };
}

export interface RealtimeAlert {
  type: string;
  priority: 'high' | 'medium' | 'low';
  student?: string;
  subject?: string;
  score?: number;
  count?: number;
  message: string;
  timestamp: string;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label?: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    tension?: number;
    fill?: boolean;
  }>;
}

export interface StudentResultsStats {
  overview: {
    totalExams: number;
    passedExams: number;
    failedExams: number;
    passRate: number;
    averageScore: number;
  };
  byGender: Array<{ gender: string; average: number }>;
  byClass: {
    average: number;
    passRate: number;
    totalStudents: number;
  } | null;
  topPerformers: Array<{
    studentId: string;
    name: string;
    average: number;
  }>;
  improvementAreas: Array<{
    subjectId: string;
    subject: string;
    average: number;
    passRate: number;
  }>;
}

export interface SubscriptionStats {
  subscription: {
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    maxStudents: number;
  } | null;
  students: {
    total: number;
    active: number;
    inactive: number;
    utilizationRate: number;
  };
  payments: {
    totalRevenue: number;
    paidCount: number;
    pendingCount: number;
    pendingAmount: number;
    collectionRate: number;
  };
  revenueHistory: Array<{
    date: string;
    amount: number;
    status: string;
  }>;
}
