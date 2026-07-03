import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

interface DefaultTemplateDef {
  name: string;
  channel: CommCloudChannel[];
  type: string;
  subject?: string;
  body: string;
  isDefault: boolean;
  scope: string;
  category: string;
  variables: { name: string; type: string; required: boolean }[];
}

const DEFAULT_TEMPLATES: DefaultTemplateDef[] = [
  {
    name: 'attendance-notification',
    channel: ['SMS', 'EMAIL'],
    type: 'attendance',
    subject: 'Attendance Notification - {{studentName}}',
    body: 'Dear {{parentName}}, your child {{studentName}} was {{status}} on {{date}}.',
    isDefault: true,
    scope: 'platform',
    category: 'notifications',
    variables: [
      { name: 'parentName', type: 'string', required: true },
      { name: 'studentName', type: 'string', required: true },
      { name: 'status', type: 'string', required: true },
      { name: 'date', type: 'string', required: true },
    ],
  },
  {
    name: 'result-published',
    channel: ['SMS', 'EMAIL'],
    type: 'results',
    subject: 'Results Published - {{studentName}}',
    body: 'Dear {{parentName}}, results for {{studentName}} are now available.',
    isDefault: true,
    scope: 'platform',
    category: 'academic',
    variables: [
      { name: 'parentName', type: 'string', required: true },
      { name: 'studentName', type: 'string', required: true },
    ],
  },
  {
    name: 'fee-reminder',
    channel: ['SMS', 'EMAIL'],
    type: 'fees',
    subject: 'Fee Reminder - {{amount}} Due',
    body: 'Dear {{parentName}}, this is a reminder that school fees of {{amount}} are due by {{dueDate}}.',
    isDefault: true,
    scope: 'platform',
    category: 'finance',
    variables: [
      { name: 'parentName', type: 'string', required: true },
      { name: 'amount', type: 'string', required: true },
      { name: 'dueDate', type: 'string', required: true },
    ],
  },
  {
    name: 'admission-confirmation',
    channel: ['SMS', 'EMAIL'],
    type: 'admissions',
    subject: 'Admission Confirmed - {{schoolName}}',
    body: 'Congratulations {{studentName}}! Your admission to {{schoolName}} has been confirmed.',
    isDefault: true,
    scope: 'platform',
    category: 'admissions',
    variables: [
      { name: 'studentName', type: 'string', required: true },
      { name: 'schoolName', type: 'string', required: true },
    ],
  },
  {
    name: 'registration-welcome',
    channel: ['SMS', 'EMAIL'],
    type: 'registration',
    subject: 'Welcome to {{platformName}}',
    body: 'Welcome {{fullName}}! You have been registered on {{platformName}}.',
    isDefault: true,
    scope: 'platform',
    category: 'onboarding',
    variables: [
      { name: 'fullName', type: 'string', required: true },
      { name: 'platformName', type: 'string', required: true },
    ],
  },
  {
    name: 'password-reset',
    channel: ['SMS', 'EMAIL'],
    type: 'password_reset',
    subject: 'Password Reset OTP',
    body: 'Your OTP for password reset is {{otp}}. It expires in {{expiryMinutes}} minutes.',
    isDefault: true,
    scope: 'platform',
    category: 'auth',
    variables: [
      { name: 'otp', type: 'string', required: true },
      { name: 'expiryMinutes', type: 'string', required: true },
    ],
  },
  {
    name: 'otp-verification',
    channel: ['SMS'],
    type: 'OTP',
    body: 'Your verification code is {{otp}}. Valid for {{expiryMinutes}} minutes.',
    isDefault: true,
    scope: 'platform',
    category: 'auth',
    variables: [
      { name: 'otp', type: 'string', required: true },
      { name: 'expiryMinutes', type: 'string', required: true },
    ],
  },
  {
    name: 'emergency-alert',
    channel: ['SMS'],
    type: 'emergency',
    body: 'EMERGENCY: {{message}}. {{schoolName}} - {{timestamp}}',
    isDefault: true,
    scope: 'platform',
    category: 'emergency',
    variables: [
      { name: 'message', type: 'string', required: true },
      { name: 'schoolName', type: 'string', required: true },
      { name: 'timestamp', type: 'string', required: true },
    ],
  },
];

@Injectable()
export class TemplateLibraryService {
  private readonly logger = new Logger(TemplateLibraryService.name);

  constructor(private prisma: PrismaService) {}

  async getTemplates(channel?: string, type?: string, scope?: string, schoolId?: string) {
    const where: any = { isActive: true };
    if (channel) where.channel = channel;
    if (type) where.type = type;
    if (scope) where.scope = scope;
    if (schoolId) where.schoolId = schoolId;

    return this.prisma.commCloudTemplate.findMany({
      where,
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.commCloudTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Template not found: ${id}`);
    return template;
  }

  async createTemplate(data: {
    name: string;
    channel: CommCloudChannel;
    type: string;
    subject?: string;
    body: string;
    htmlBody?: string;
    variables?: Record<string, unknown>;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
    category?: string;
    tags?: string[];
  }) {
    return this.prisma.commCloudTemplate.create({
      data: {
        name: data.name,
        channel: data.channel,
        type: data.type,
        subject: data.subject ?? null,
        body: data.body,
        htmlBody: data.htmlBody ?? null,
        variables: data.variables ?? undefined,
        scope: data.scope ?? 'platform',
        schoolId: data.schoolId ?? null,
        isDefault: data.isDefault ?? false,
        category: data.category ?? null,
        tags: data.tags ?? undefined,
      },
    });
  }

  async updateTemplate(id: string, data: {
    name?: string;
    channel?: CommCloudChannel;
    type?: string;
    subject?: string;
    body?: string;
    htmlBody?: string;
    variables?: Record<string, unknown>;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
    isActive?: boolean;
    category?: string;
    tags?: string[];
  }) {
    await this.getTemplate(id);
    return this.prisma.commCloudTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.subject !== undefined && { subject: data.subject }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.htmlBody !== undefined && { htmlBody: data.htmlBody }),
        ...(data.variables !== undefined && { variables: data.variables }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.schoolId !== undefined && { schoolId: data.schoolId }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.tags !== undefined && { tags: data.tags }),
      },
    });
  }

  async deleteTemplate(id: string) {
    await this.getTemplate(id);
    return this.prisma.commCloudTemplate.delete({ where: { id } });
  }

  async renderTemplate(templateId: string, variables: Record<string, string>) {
    const template = await this.getTemplate(templateId);

    const render = (text: string | null | undefined): string | undefined => {
      if (!text) return undefined;
      return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
    };

    return {
      subject: render(template.subject),
      body: render(template.body),
      htmlBody: render(template.htmlBody),
    };
  }

  getDefaultTemplates(): DefaultTemplateDef[] {
    return DEFAULT_TEMPLATES;
  }

  async seedDefaults() {
    const created: string[] = [];
    const skipped: string[] = [];

    for (const def of DEFAULT_TEMPLATES) {
      for (const channel of def.channel) {
        const existing = await this.prisma.commCloudTemplate.findFirst({
          where: {
            name: def.name,
            channel,
            scope: 'platform',
            schoolId: null,
          },
        });

        if (existing) {
          skipped.push(`${def.name} (${channel})`);
          continue;
        }

        await this.prisma.commCloudTemplate.create({
          data: {
            name: def.name,
            channel,
            type: def.type,
            subject: def.subject ?? null,
            body: def.body,
            isDefault: true,
            scope: 'platform',
            category: def.category,
            variables: def.variables,
          },
        });

        created.push(`${def.name} (${channel})`);
      }
    }

    this.logger.log(`Seeded default templates: created [${created.join(', ')}], skipped [${skipped.join(', ')}]`);

    return { created, skipped };
  }
}
