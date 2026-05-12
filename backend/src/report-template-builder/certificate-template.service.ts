import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CertificateType } from '@prisma/client';

@Injectable()
export class CertificateTemplateService {
  constructor(private prisma: PrismaService) {}

  async getCertificateSettings(schoolId: string, templateId: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    let cert = await this.prisma.certificateTemplate.findUnique({ where: { templateId } });
    if (!cert) {
      cert = await this.prisma.certificateTemplate.create({
        data: { templateId },
      });
    }
    return cert;
  }

  async updateCertificateSettings(schoolId: string, templateId: string, data: {
    certificateType?: CertificateType;
    borderStyle?: string;
    borderColor?: string;
    sealUrl?: string;
    showQrCode?: boolean;
    autoNumbering?: boolean;
    nextNumber?: number;
    showPhoto?: boolean;
    signature1Label?: string;
    signature1Name?: string;
    signature1Title?: string;
    signature2Label?: string;
    signature2Name?: string;
    signature2Title?: string;
    awardText?: string;
    showBadge?: boolean;
    badgeStyle?: string;
    showWatermark?: boolean;
    watermarkText?: string;
    layoutJson?: any;
  }) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    return this.prisma.certificateTemplate.upsert({
      where: { templateId },
      create: { templateId, ...data },
      update: data,
    });
  }

  async getNextCertificateNumber(schoolId: string, templateId: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    const cert = await this.prisma.certificateTemplate.findUnique({ where: { templateId } });
    if (!cert || !cert.autoNumbering) return null;

    const number = cert.nextNumber;
    const padded = String(number).padStart(6, '0');
    const prefix = t.name.substring(0, 3).toUpperCase();
    return `${prefix}-${padded}`;
  }

  async incrementCertificateNumber(schoolId: string, templateId: string) {
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    return this.prisma.certificateTemplate.update({
      where: { templateId },
      data: { nextNumber: { increment: 1 } },
    });
  }
}
