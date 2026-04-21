import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportTemplateService {
  constructor(private prisma: PrismaService) {}

  async getTemplates(schoolId: string) {
    return this.prisma.reportTemplate.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(schoolId: string, id: string) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async getDefaultTemplate(schoolId: string) {
    let template = await this.prisma.reportTemplate.findFirst({
      where: { schoolId, isDefault: true },
    });

    if (!template) {
      template = await this.prisma.reportTemplate.findFirst({
        where: { schoolId },
      });
    }

    return template;
  }

  async createTemplate(schoolId: string, data: {
    name: string;
    headerText?: string;
    footerText?: string;
    logoUrl?: string;
    stampUrl?: string;
    signatureUrl?: string;
    directorName?: string;
    includeLogo?: boolean;
    includeStamp?: boolean;
    includeSignature?: boolean;
    includeUniversity?: boolean;
    includeBestSix?: boolean;
    includeRankings?: boolean;
    includeComments?: boolean;
    includeGrading?: boolean;
    primaryColor?: string;
    secondaryColor?: string;
    remarksEnabled?: boolean;
    customRemarks?: any;
    isDefault?: boolean;
  }) {
    if (data.isDefault) {
      await this.prisma.reportTemplate.updateMany({
        where: { schoolId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.reportTemplate.create({
      data: {
        ...data,
        schoolId,
      },
    });
  }

  async updateTemplate(schoolId: string, id: string, data: Partial<{
    name: string;
    headerText: string;
    footerText: string;
    logoUrl: string;
    stampUrl: string;
    signatureUrl: string;
    directorName: string;
    includeLogo: boolean;
    includeStamp: boolean;
    includeSignature: boolean;
    includeUniversity: boolean;
    includeBestSix: boolean;
    includeRankings: boolean;
    includeComments: boolean;
    includeGrading: boolean;
    primaryColor: string;
    secondaryColor: string;
    remarksEnabled: boolean;
    customRemarks: any;
    isDefault: boolean;
  }>) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (data.isDefault && !template.isDefault) {
      await this.prisma.reportTemplate.updateMany({
        where: { schoolId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.reportTemplate.update({
      where: { id },
      data,
    });
  }

  async deleteTemplate(schoolId: string, id: string) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.isDefault) {
      throw new BadRequestException('Cannot delete default template');
    }

    return this.prisma.reportTemplate.delete({
      where: { id },
    });
  }

  async uploadStamp(schoolId: string, id: string, file: Express.Multer.File) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const stampUrl = `/uploads/report-templates/${file.filename}`;

    return this.prisma.reportTemplate.update({
      where: { id },
      data: { stampUrl },
    });
  }

  async uploadSignature(schoolId: string, id: string, file: Express.Multer.File) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const signatureUrl = `/uploads/report-templates/${file.filename}`;

    return this.prisma.reportTemplate.update({
      where: { id },
      data: { signatureUrl },
    });
  }

  async uploadLogo(schoolId: string, id: string, file: Express.Multer.File) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id, schoolId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const logoUrl = `/uploads/report-templates/${file.filename}`;

    return this.prisma.reportTemplate.update({
      where: { id },
      data: { logoUrl },
    });
  }
}
