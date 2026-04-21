import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';

export interface FeatureLockDto {
  key: string;
  name: string;
  description?: string;
  category: string;
  minTier: SubscriptionTier;
  isEnabled: boolean;
  isLocked: boolean;
  limits?: {
    basic?: number;
    standard?: number;
    premium?: number;
  };
}

const DEFAULT_FEATURES: Omit<FeatureLockDto, 'isEnabled' | 'isLocked'>[] = [
  { key: 'students.view', name: 'View Students', description: 'View student list and details', category: 'students', minTier: 'BASIC' },
  { key: 'students.add', name: 'Add Students', description: 'Add new students to the system', category: 'students', minTier: 'BASIC' },
  { key: 'students.bulkImport', name: 'Bulk Import Students', description: 'Import students via Excel/CSV', category: 'students', minTier: 'BASIC', limits: { basic: 100, standard: 500, premium: -1 } },
  { key: 'students.advanced', name: 'Advanced Student Features', description: 'Health records, guardians management, attendance', category: 'students', minTier: 'STANDARD' },
  
  { key: 'teachers.view', name: 'View Teachers', description: 'View teacher list and details', category: 'teachers', minTier: 'BASIC' },
  { key: 'teachers.add', name: 'Add Teachers', description: 'Add new teachers to the system', category: 'teachers', minTier: 'BASIC' },
  { key: 'teachers.bulkImport', name: 'Bulk Import Teachers', description: 'Import teachers via Excel/CSV', category: 'teachers', minTier: 'STANDARD' },
  
  { key: 'classes.view', name: 'View Classes', description: 'View class list and details', category: 'classes', minTier: 'BASIC' },
  { key: 'classes.add', name: 'Add Classes', description: 'Create new classes', category: 'classes', minTier: 'BASIC', limits: { basic: 10, standard: 30, premium: -1 } },
  
  { key: 'subjects.view', name: 'View Subjects', description: 'View subject list', category: 'subjects', minTier: 'BASIC' },
  { key: 'subjects.add', name: 'Add Subjects', description: 'Create new subjects', category: 'subjects', minTier: 'BASIC', limits: { basic: 10, standard: 25, premium: -1 } },
  
  { key: 'timetable.view', name: 'View Timetable', description: 'View master and class timetables', category: 'timetable', minTier: 'BASIC' },
  { key: 'timetable.edit', name: 'Edit Timetable', description: 'Manually edit and adjust timetable', category: 'timetable', minTier: 'BASIC' },
  { key: 'timetable.generate', name: 'AI Timetable Generator', description: 'Auto-generate timetables using AI', category: 'timetable', minTier: 'STANDARD' },
  { key: 'timetable.constraints', name: 'Timetable Constraints', description: 'Set custom constraints for scheduling', category: 'timetable', minTier: 'PREMIUM' },
  
  { key: 'results.view', name: 'View Results', description: 'View student results', category: 'results', minTier: 'BASIC' },
  { key: 'results.add', name: 'Add Results', description: 'Enter and manage student results', category: 'results', minTier: 'BASIC' },
  { key: 'results.bulkImport', name: 'Bulk Import Results', description: 'Import results via Excel', category: 'results', minTier: 'BASIC' },
  { key: 'results.reports', name: 'Result Reports', description: 'Generate comprehensive result reports', category: 'results', minTier: 'STANDARD' },
  
  { key: 'fees.view', name: 'View Fees', description: 'View fee structure and payments', category: 'fees', minTier: 'BASIC' },
  { key: 'fees.manage', name: 'Manage Fees', description: 'Create and modify fee structures', category: 'fees', minTier: 'BASIC' },
  { key: 'fees.onlinePayment', name: 'Online Payment', description: 'Enable online fee payment gateway', category: 'fees', minTier: 'STANDARD' },
  
  { key: 'communications.view', name: 'View Communications', description: 'View messages and notifications', category: 'communications', minTier: 'BASIC' },
  { key: 'communications.send', name: 'Send Messages', description: 'Send messages to parents and teachers', category: 'communications', minTier: 'BASIC' },
  { key: 'communications.bulk', name: 'Bulk Messaging', description: 'Send bulk SMS and emails', category: 'communications', minTier: 'STANDARD' },
  { key: 'communications.whatsapp', name: 'WhatsApp Integration', description: 'Send messages via WhatsApp', category: 'communications', minTier: 'PREMIUM' },
  
  { key: 'analytics.view', name: 'View Analytics', description: 'View basic analytics dashboards', category: 'analytics', minTier: 'BASIC' },
  { key: 'analytics.advanced', name: 'Advanced Analytics', description: 'Predictive analytics and insights', category: 'analytics', minTier: 'STANDARD' },
  { key: 'analytics.ai', name: 'AI-Powered Insights', description: 'AI-generated recommendations and predictions', category: 'analytics', minTier: 'PREMIUM' },
  
  { key: 'reports.generate', name: 'Generate Reports', description: 'Generate standard system reports', category: 'reports', minTier: 'BASIC' },
  { key: 'reports.custom', name: 'Custom Reports', description: 'Create and customize reports', category: 'reports', minTier: 'STANDARD' },
  { key: 'reports.export', name: 'Export Reports', description: 'Export reports in various formats', category: 'reports', minTier: 'BASIC' },
  
  { key: 'integrations.api', name: 'API Access', description: 'Access to REST API for integrations', category: 'integrations', minTier: 'STANDARD' },
  { key: 'integrations.webhooks', name: 'Webhooks', description: 'Configure webhook notifications', category: 'integrations', minTier: 'PREMIUM' },
  
  { key: 'advanced.backup', name: 'Data Backup', description: 'Automated data backup', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.restore', name: 'Data Restore', description: 'Restore from backup', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.multiuser', name: 'Multi-user Access', description: 'Multiple admin user accounts', category: 'advanced', minTier: 'STANDARD' },
  { key: 'advanced.sso', name: 'Single Sign-On (SSO)', description: 'SSO integration with external systems', category: 'advanced', minTier: 'PREMIUM' },
  
  { key: 'library', name: 'Digital Library', description: 'School document library', category: 'timetable', minTier: 'BASIC' },
  { key: 'lessonplans', name: 'Lesson Plans', description: 'Create and manage lesson plans', category: 'timetable', minTier: 'BASIC' },
];

@Injectable()
export class FeatureLockService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<FeatureLockDto[]> {
    const features = await this.prisma.featureLock.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    if (features.length === 0) {
      await this.seedDefaultFeatures();
      return this.findAll();
    }

    return features.map(f => ({
      key: f.key,
      name: f.name,
      description: f.description || undefined,
      category: f.category,
      minTier: f.minTier,
      isEnabled: f.isEnabled,
      isLocked: f.isLocked,
      limits: f.limits as FeatureLockDto['limits'] || undefined,
    }));
  }

  async findOne(key: string): Promise<FeatureLockDto> {
    const feature = await this.prisma.featureLock.findUnique({
      where: { key },
    });

    if (!feature) {
      throw new NotFoundException(`Feature with key "${key}" not found`);
    }

    return {
      key: feature.key,
      name: feature.name,
      description: feature.description || undefined,
      category: feature.category,
      minTier: feature.minTier,
      isEnabled: feature.isEnabled,
      isLocked: feature.isLocked,
      limits: feature.limits as FeatureLockDto['limits'] || undefined,
    };
  }

  async update(key: string, data: {
    name?: string;
    description?: string;
    category?: string;
    minTier?: SubscriptionTier;
    isEnabled?: boolean;
    isLocked?: boolean;
    limits?: FeatureLockDto['limits'];
  }): Promise<FeatureLockDto> {
    const feature = await this.prisma.featureLock.findUnique({
      where: { key },
    });

    if (!feature) {
      throw new NotFoundException(`Feature with key "${key}" not found`);
    }

    const updated = await this.prisma.featureLock.update({
      where: { key },
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        minTier: data.minTier,
        isEnabled: data.isEnabled,
        isLocked: data.isLocked,
        limits: data.limits as any,
      },
    });

    return {
      key: updated.key,
      name: updated.name,
      description: updated.description || undefined,
      category: updated.category,
      minTier: updated.minTier,
      isEnabled: updated.isEnabled,
      isLocked: updated.isLocked,
      limits: updated.limits as FeatureLockDto['limits'] || undefined,
    };
  }

  async resetToDefaults(): Promise<{ message: string }> {
    await this.prisma.featureLock.deleteMany();
    await this.seedDefaultFeatures();
    return { message: 'Feature locks reset to defaults' };
  }

  async seedDefaultFeatures(): Promise<void> {
    for (const feature of DEFAULT_FEATURES) {
      await this.prisma.featureLock.upsert({
        where: { key: feature.key },
        update: {},
        create: {
          key: feature.key,
          name: feature.name,
          description: feature.description,
          category: feature.category,
          minTier: feature.minTier,
          limits: feature.limits as any,
          isEnabled: true,
          isLocked: false,
        },
      });
    }
  }

  async checkAccess(schoolId: string, featureKey: string): Promise<{
    hasAccess: boolean;
    reason?: string;
  }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const feature = await this.prisma.featureLock.findUnique({
      where: { key: featureKey },
    });

    if (!feature) {
      return { hasAccess: true };
    }

    if (!feature.isEnabled) {
      return { hasAccess: false, reason: 'Feature is disabled' };
    }

    if (feature.isLocked) {
      return { hasAccess: false, reason: 'Feature is locked by administrator' };
    }

    const tierOrder: Record<SubscriptionTier, number> = {
      BASIC: 1,
      STANDARD: 2,
      PREMIUM: 3,
    };

    const schoolTier = (school.subscriptionTier?.toUpperCase() as SubscriptionTier) || 'BASIC';
    const requiredTier = feature.minTier;

    if (tierOrder[schoolTier] < tierOrder[requiredTier]) {
      return { 
        hasAccess: false, 
        reason: `Requires ${requiredTier} tier. Current: ${schoolTier}` 
      };
    }

    return { hasAccess: true };
  }

  async getFeaturesForSchool(schoolId: string): Promise<{
    features: FeatureLockDto[];
    tier: string;
    lockedFeatures: string[];
    disabledFeatures: string[];
  }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const features = await this.findAll();
    const schoolTier = school.subscriptionTier || 'BASIC';

    const tierOrder: Record<SubscriptionTier, number> = {
      BASIC: 1,
      STANDARD: 2,
      PREMIUM: 3,
    };

    const lockedFeatures: string[] = [];
    const disabledFeatures: string[] = [];

    const accessibleFeatures = features.filter(f => {
      if (!f.isEnabled) {
        disabledFeatures.push(f.key);
        return false;
      }
      if (f.isLocked) {
        lockedFeatures.push(f.key);
        return false;
      }
      if (tierOrder[schoolTier.toUpperCase() as SubscriptionTier] < tierOrder[f.minTier]) {
        lockedFeatures.push(f.key);
        return false;
      }
      return true;
    });

    return {
      features: accessibleFeatures,
      tier: schoolTier,
      lockedFeatures,
      disabledFeatures,
    };
  }
}
