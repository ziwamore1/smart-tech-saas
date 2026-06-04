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
  // ── Students ──
  { key: 'students.view', name: 'View Students', description: 'View student list and details', category: 'students', minTier: 'BASIC' },
  { key: 'students.add', name: 'Add Students', description: 'Add new students to the system', category: 'students', minTier: 'BASIC' },
  { key: 'students.bulkImport', name: 'Bulk Import Students', description: 'Import students via Excel/CSV', category: 'students', minTier: 'BASIC', limits: { basic: 100, standard: 500, premium: -1 } },
  { key: 'students.advanced', name: 'Advanced Student Features', description: 'Health records, guardians management, attendance', category: 'students', minTier: 'STANDARD' },
  { key: 'students.analytics', name: 'Student Performance Analytics', description: 'Detailed analytics per student', category: 'students', minTier: 'STANDARD' },
  { key: 'students.growth', name: 'Student Growth Tracking', description: 'Academic growth and competency tracking', category: 'students', minTier: 'STANDARD' },

  // ── Teachers ──
  { key: 'teachers.view', name: 'View Teachers', description: 'View teacher list and details', category: 'teachers', minTier: 'BASIC' },
  { key: 'teachers.add', name: 'Add Teachers', description: 'Add new teachers to the system', category: 'teachers', minTier: 'BASIC' },
  { key: 'teachers.bulkImport', name: 'Bulk Import Teachers', description: 'Import teachers via Excel/CSV', category: 'teachers', minTier: 'STANDARD' },
  { key: 'teachers.analytics', name: 'Teacher Analytics', description: 'Teacher performance and workload insights', category: 'teachers', minTier: 'STANDARD' },

  // ── Classes ──
  { key: 'classes.view', name: 'View Classes', description: 'View class list and details', category: 'classes', minTier: 'BASIC' },
  { key: 'classes.add', name: 'Add Classes', description: 'Create new classes', category: 'classes', minTier: 'BASIC', limits: { basic: 10, standard: 30, premium: -1 } },
  { key: 'classes.analytics', name: 'Class Analytics', description: 'Class-level performance breakdown', category: 'classes', minTier: 'STANDARD' },

  // ── Subjects ──
  { key: 'subjects.view', name: 'View Subjects', description: 'View subject list', category: 'subjects', minTier: 'BASIC' },
  { key: 'subjects.add', name: 'Add Subjects', description: 'Create new subjects', category: 'subjects', minTier: 'BASIC', limits: { basic: 10, standard: 25, premium: -1 } },

  // ── Timetable ──
  { key: 'timetable.view', name: 'View Timetable', description: 'View master and class timetables', category: 'timetable', minTier: 'BASIC' },
  { key: 'timetable.edit', name: 'Edit Timetable', description: 'Manually edit and adjust timetable', category: 'timetable', minTier: 'BASIC' },
  { key: 'timetable.generate', name: 'AI Timetable Generator', description: 'Auto-generate timetables using AI', category: 'timetable', minTier: 'STANDARD' },
  { key: 'timetable.constraints', name: 'Timetable Constraints', description: 'Set custom constraints for scheduling', category: 'timetable', minTier: 'PREMIUM' },

  // ── Attendance ──
  { key: 'attendance.register', name: 'Attendance Register', description: 'Mark daily attendance', category: 'attendance', minTier: 'BASIC' },
  { key: 'attendance.dashboard', name: 'Attendance Dashboard', description: 'Attendance analytics and trends', category: 'attendance', minTier: 'STANDARD' },
  { key: 'attendance.reports', name: 'Attendance Reports', description: 'Detailed attendance reports and exports', category: 'attendance', minTier: 'STANDARD' },

  // ── Results ──
  { key: 'results.view', name: 'View Results', description: 'View student results', category: 'results', minTier: 'BASIC' },
  { key: 'results.add', name: 'Add Results', description: 'Enter and manage student results', category: 'results', minTier: 'BASIC' },
  { key: 'results.bulkImport', name: 'Bulk Import Results', description: 'Import results via Excel', category: 'results', minTier: 'BASIC' },
  { key: 'results.reports', name: 'Result Reports', description: 'Generate comprehensive result reports', category: 'results', minTier: 'STANDARD' },
  { key: 'results.grading', name: 'Grading Policies', description: 'Custom grading scales and policies', category: 'results', minTier: 'STANDARD' },
  { key: 'results.reportCards', name: 'Report Cards', description: 'Generate and customize report cards', category: 'results', minTier: 'STANDARD' },
  { key: 'results.certificate', name: 'Certificate Designer', description: 'Design and issue certificates', category: 'results', minTier: 'PREMIUM' },

  // ── Assessments ──
  { key: 'assessments.view', name: 'View Assessments', description: 'View assessment configurations', category: 'assessments', minTier: 'BASIC' },
  { key: 'assessments.entry', name: 'Score Entry', description: 'Enter assessment scores', category: 'assessments', minTier: 'BASIC' },
  { key: 'assessments.config', name: 'Assessment Configuration', description: 'Configure grading and assessment types', category: 'assessments', minTier: 'STANDARD' },

  // ── Fees ──
  { key: 'fees.view', name: 'View Fees', description: 'View fee structure and payments', category: 'fees', minTier: 'BASIC' },
  { key: 'fees.manage', name: 'Manage Fees', description: 'Create and modify fee structures', category: 'fees', minTier: 'BASIC' },
  { key: 'fees.onlinePayment', name: 'Online Payment', description: 'Enable online fee payment gateway', category: 'fees', minTier: 'STANDARD' },

  // ── Communications ──
  { key: 'communications.view', name: 'View Communications', description: 'View messages and notifications', category: 'communications', minTier: 'BASIC' },
  { key: 'communications.send', name: 'Send Messages', description: 'Send messages to parents and teachers', category: 'communications', minTier: 'BASIC' },
  { key: 'communications.bulk', name: 'Bulk Messaging', description: 'Send bulk SMS and emails', category: 'communications', minTier: 'STANDARD' },
  { key: 'communications.whatsapp', name: 'WhatsApp Integration', description: 'Send messages via Beem WhatsApp', category: 'communications', minTier: 'PREMIUM' },

  // ── Analytics ──
  { key: 'analytics.view', name: 'View Analytics', description: 'View basic analytics dashboards', category: 'analytics', minTier: 'BASIC' },
  { key: 'analytics.advanced', name: 'Advanced Analytics', description: 'Predictive analytics and insights', category: 'analytics', minTier: 'STANDARD' },
  { key: 'analytics.ai', name: 'AI-Powered Insights', description: 'AI-generated recommendations and predictions', category: 'analytics', minTier: 'PREMIUM' },
  { key: 'analytics.enhanced', name: 'Enhanced Analytics', description: 'ECharts visualizations and heatmaps', category: 'analytics', minTier: 'STANDARD' },

  // ── Reports ──
  { key: 'reports.generate', name: 'Generate Reports', description: 'Generate standard system reports', category: 'reports', minTier: 'BASIC' },
  { key: 'reports.custom', name: 'Custom Reports', description: 'Create and customize reports', category: 'reports', minTier: 'STANDARD' },
  { key: 'reports.export', name: 'Export Reports', description: 'Export reports in various formats', category: 'reports', minTier: 'BASIC' },
  { key: 'reports.templates', name: 'Report Templates', description: 'Customizable report template builder', category: 'reports', minTier: 'STANDARD' },

  // ── Intelligence / AI Features ──
  { key: 'intelligence.ai-tutor', name: 'AI Tutor', description: 'Intelligent tutoring assistant with subject-specific engines', category: 'intelligence', minTier: 'PREMIUM' },
  { key: 'intelligence.benchmarking', name: 'Benchmarking', description: 'National average comparisons', category: 'intelligence', minTier: 'PREMIUM' },
  { key: 'intelligence.psychometric', name: 'Psychometric Analysis', description: 'Exam reliability and item analysis', category: 'intelligence', minTier: 'PREMIUM' },
  { key: 'intelligence.adaptive-testing', name: 'Adaptive Testing', description: 'IRT-based computerized adaptive testing', category: 'intelligence', minTier: 'PREMIUM' },
  { key: 'intelligence.learning-style', name: 'Learning Style Analysis', description: 'VARK assessment and personalized insights', category: 'intelligence', minTier: 'STANDARD' },
  { key: 'intelligence.exam-quality', name: 'Exam Quality Analysis', description: 'Quality metrics, grade inflation detection, blueprints', category: 'intelligence', minTier: 'PREMIUM' },
  { key: 'intelligence.subject-engines', name: 'Subject-Specific AI Engines', description: 'Math, Science, English, Humanities domain AI', category: 'intelligence', minTier: 'PREMIUM' },

  // ── Online Exams ──
  { key: 'exams.create', name: 'Create Exams', description: 'Create and configure online exams', category: 'exams', minTier: 'STANDARD' },
  { key: 'exams.take', name: 'Take Exams', description: 'Student online exam taking', category: 'exams', minTier: 'BASIC' },
  { key: 'exams.autoGrade', name: 'Auto-Grading', description: 'Automatic exam grading', category: 'exams', minTier: 'STANDARD' },

  // ── Library ──
  { key: 'library.view', name: 'Digital Library', description: 'Browse school document library', category: 'library', minTier: 'BASIC' },
  { key: 'library.upload', name: 'Library Upload', description: 'Upload documents to library', category: 'library', minTier: 'STANDARD' },

  // ── Lesson Plans ──
  { key: 'lessonplans.view', name: 'View Lesson Plans', description: 'View lesson plans', category: 'lessonplans', minTier: 'BASIC' },
  { key: 'lessonplans.create', name: 'Create Lesson Plans', description: 'Create and manage lesson plans', category: 'lessonplans', minTier: 'BASIC' },
  { key: 'lessonplans.ai', name: 'AI Lesson Plan Generator', description: 'Generate lesson plans using AI', category: 'lessonplans', minTier: 'PREMIUM' },

  // ── Digital Stamps & Signatures ──
  { key: 'stamps.view', name: 'View Stamps', description: 'View digital stamps', category: 'stamps', minTier: 'BASIC' },
  { key: 'stamps.apply', name: 'Apply Stamps', description: 'Apply stamps to documents', category: 'stamps', minTier: 'STANDARD' },
  { key: 'stamps.create', name: 'Create Stamps', description: 'Create custom digital stamps', category: 'stamps', minTier: 'STANDARD' },
  { key: 'stamps.verify', name: 'Verify Documents', description: 'Verify stamped documents via hash', category: 'stamps', minTier: 'BASIC' },
  { key: 'stamps.signatures', name: 'Digital Signatures', description: 'Create and manage digital signatures', category: 'stamps', minTier: 'STANDARD' },
  { key: 'stamps.blockchain', name: 'Blockchain Certificates', description: 'Issue blockchain-verified certificates', category: 'stamps', minTier: 'PREMIUM' },
  { key: 'stamps.approvals', name: 'Approval Workflows', description: 'Multi-step approval workflows', category: 'stamps', minTier: 'STANDARD' },

  // ── Gallery ──
  { key: 'gallery.view', name: 'View Gallery', description: 'View photo gallery', category: 'gallery', minTier: 'BASIC' },
  { key: 'gallery.upload', name: 'Upload Photos', description: 'Upload photos to school gallery', category: 'gallery', minTier: 'STANDARD' },

  // ── Template Builder ──
  { key: 'templates.view', name: 'View Templates', description: 'View report templates', category: 'templates', minTier: 'BASIC' },
  { key: 'templates.create', name: 'Create Templates', description: 'Design custom report templates', category: 'templates', minTier: 'STANDARD' },
  { key: 'templates.marketplace', name: 'Template Marketplace', description: 'Browse and install community templates', category: 'templates', minTier: 'STANDARD' },
  { key: 'templates.ai', name: 'AI Template Generator', description: 'Generate templates using AI', category: 'templates', minTier: 'PREMIUM' },

  // ── Integrations ──
  { key: 'integrations.api', name: 'API Access', description: 'Access to REST API for integrations', category: 'integrations', minTier: 'STANDARD' },
  { key: 'integrations.webhooks', name: 'Webhooks', description: 'Configure webhook notifications', category: 'integrations', minTier: 'PREMIUM' },
  { key: 'integrations.ministry', name: 'Ministry Integration', description: 'Ministry of Education API sync', category: 'integrations', minTier: 'PREMIUM' },

  // ── Advanced ──
  { key: 'advanced.backup', name: 'Data Backup', description: 'Automated data backup', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.restore', name: 'Data Restore', description: 'Restore from backup', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.multiuser', name: 'Multi-user Access', description: 'Multiple admin user accounts', category: 'advanced', minTier: 'STANDARD' },
  { key: 'advanced.sso', name: 'Single Sign-On (SSO)', description: 'SSO integration with external systems', category: 'advanced', minTier: 'PREMIUM' },
  { key: 'advanced.settings', name: 'System Settings', description: 'School configuration and settings', category: 'advanced', minTier: 'BASIC' },
  { key: 'advanced.audit', name: 'Audit Logs', description: 'System audit trail', category: 'advanced', minTier: 'STANDARD' },

  // ── Branding ──
  { key: 'branding.logo', name: 'School Branding', description: 'Upload logo and customize branding', category: 'branding', minTier: 'BASIC' },
  { key: 'branding.presets', name: 'Brand Presets', description: 'Save and apply brand presets', category: 'branding', minTier: 'STANDARD' },

  // ── Primary School Features ──
  { key: 'primary.dashboard', name: 'Primary Dashboard', description: 'View primary school dashboard overview', category: 'primary', minTier: 'BASIC' },
  { key: 'primary.students', name: 'Primary Pupils', description: 'Manage pupil records and admissions', category: 'primary', minTier: 'BASIC' },
  { key: 'primary.classes', name: 'Primary Classes', description: 'View and manage primary class rosters', category: 'primary', minTier: 'BASIC' },
  { key: 'primary.attendance', name: 'Primary Attendance', description: 'Mark and track daily pupil attendance', category: 'primary', minTier: 'BASIC' },
  { key: 'primary.results', name: 'Primary Results', description: 'Enter continuous assessment scores', category: 'primary', minTier: 'BASIC' },
  { key: 'primary.staff', name: 'Primary Staff', description: 'Manage teaching and non-teaching staff', category: 'primary', minTier: 'STANDARD' },
  { key: 'primary.parents', name: 'Parent Portal', description: 'Parent registration, linking, and communication', category: 'primary', minTier: 'STANDARD' },
  { key: 'primary.reportCards', name: 'Curriculum Report Cards', description: 'Generate curriculum-based report cards with division badges', category: 'primary', minTier: 'STANDARD' },
  { key: 'primary.curriculum', name: 'Curriculum Config', description: 'Configure scoring rules, best-subject selection, and performance categories', category: 'primary', minTier: 'STANDARD' },
  { key: 'primary.analytics', name: 'Primary Analytics', description: 'Enrollment pipeline, attendance trends, and class performance', category: 'primary', minTier: 'STANDARD' },
  { key: 'primary.ece', name: 'ECE Module', description: 'Early Childhood Education specific assessments and tracking', category: 'primary', minTier: 'STANDARD' },
  { key: 'primary.grade7', name: 'Grade 7 ECZ Management', description: 'ECZ exam registration, raw score conversion, and division computation', category: 'primary', minTier: 'PREMIUM' },
  { key: 'primary.benchmarking', name: 'Primary Benchmarking', description: 'Compare performance against national primary averages', category: 'primary', minTier: 'PREMIUM' },
  { key: 'primary.aiReports', name: 'AI Report Comments', description: 'AI-generated personalized report card comments', category: 'primary', minTier: 'PREMIUM' },
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
