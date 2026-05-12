import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandingPresetService {
  constructor(private prisma: PrismaService) {}

  async getPresets(schoolId: string) {
    return this.prisma.brandPreset.findMany({ where: { schoolId }, orderBy: { updatedAt: 'desc' } });
  }

  async getPreset(schoolId: string, id: string) {
    const p = await this.prisma.brandPreset.findFirst({ where: { id, schoolId } });
    if (!p) throw new NotFoundException('Brand preset not found');
    return p;
  }

  async createPreset(schoolId: string, data: { name: string; palette?: any; fonts?: any; logos?: any; layout?: any; metadata?: any; isDefault?: boolean }) {
    if (data.isDefault) {
      await this.prisma.brandPreset.updateMany({ where: { schoolId, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.brandPreset.create({
      data: {
        schoolId,
        name: data.name,
        palette: (data.palette || {}) as any,
        fonts: (data.fonts || {}) as any,
        logos: (data.logos || {}) as any,
        layout: (data.layout || {}) as any,
        metadata: (data.metadata || {}) as any,
        isDefault: data.isDefault || false,
      },
    });
  }

  async updatePreset(schoolId: string, id: string, data: any) {
    const p = await this.prisma.brandPreset.findFirst({ where: { id, schoolId } });
    if (!p) throw new NotFoundException('Brand preset not found');
    if (data.isDefault && !p.isDefault) {
      await this.prisma.brandPreset.updateMany({ where: { schoolId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.brandPreset.update({ where: { id }, data });
  }

  async deletePreset(schoolId: string, id: string) {
    const p = await this.prisma.brandPreset.findFirst({ where: { id, schoolId } });
    if (!p) throw new NotFoundException('Brand preset not found');
    return this.prisma.brandPreset.delete({ where: { id } });
  }

  async applyPresetToTemplate(schoolId: string, templateId: string, presetId: string) {
    const preset = await this.prisma.brandPreset.findFirst({ where: { id: presetId, schoolId } });
    if (!preset) throw new NotFoundException('Brand preset not found');
    const t = await this.prisma.reportTemplate.findFirst({ where: { id: templateId, schoolId } });
    if (!t) throw new NotFoundException('Template not found');

    const palette = preset.palette as any;
    const fonts = preset.fonts as any;
    const logos = preset.logos as any;

    return this.prisma.reportTemplate.update({
      where: { id: templateId },
      data: {
        primaryColor: palette.primary || t.primaryColor,
        secondaryColor: palette.secondary || t.secondaryColor,
        fontFamily: fonts.body || t.fontFamily,
        logoUrl: logos.logo || t.logoUrl,
        colorPalette: palette as any,
      },
    });
  }

  getDefaultPresets(): any[] {
    return [
      {
        name: 'Classic School',
        palette: { primary: '#1a365d', secondary: '#f5f5f5', accent: '#3b82f6', background: '#ffffff', text: '#333333' },
        fonts: { heading: 'Georgia', body: 'Arial', title: 'Georgia' },
        layout: { margins: { top: 15, bottom: 15, left: 15, right: 15 }, spacing: 'normal' },
      },
      {
        name: 'Modern Academy',
        palette: { primary: '#0f766e', secondary: '#f0fdfa', accent: '#14b8a6', background: '#ffffff', text: '#1e293b' },
        fonts: { heading: 'Helvetica', body: 'Arial', title: 'Helvetica' },
        layout: { margins: { top: 20, bottom: 20, left: 20, right: 20 }, spacing: 'wide' },
      },
      {
        name: 'Premium Gold',
        palette: { primary: '#92400e', secondary: '#fffbeb', accent: '#b8860b', background: '#ffffff', text: '#451a03' },
        fonts: { heading: 'Times New Roman', body: 'Georgia', title: 'Times New Roman' },
        layout: { margins: { top: 20, bottom: 20, left: 25, right: 25 }, spacing: 'elegant' },
      },
      {
        name: 'Clean Green',
        palette: { primary: '#166534', secondary: '#f0fdf4', accent: '#22c55e', background: '#ffffff', text: '#1e293b' },
        fonts: { heading: 'Verdana', body: 'Arial', title: 'Verdana' },
        layout: { margins: { top: 15, bottom: 15, left: 18, right: 18 }, spacing: 'normal' },
      },
      {
        name: 'Modern Dark',
        palette: { primary: '#1e293b', secondary: '#334155', accent: '#3b82f6', background: '#0f172a', text: '#e2e8f0' },
        fonts: { heading: 'Helvetica', body: 'Arial', title: 'Helvetica' },
        layout: { margins: { top: 15, bottom: 15, left: 15, right: 15 }, spacing: 'compact' },
      },
      {
        name: 'Minimal Gray',
        palette: { primary: '#374151', secondary: '#f9fafb', accent: '#6366f1', background: '#ffffff', text: '#111827' },
        fonts: { heading: 'Arial', body: 'Arial', title: 'Arial' },
        layout: { margins: { top: 20, bottom: 20, left: 20, right: 20 }, spacing: 'normal' },
      },
    ];
  }

  async seedDefaultPresets(schoolId: string) {
    const existing = await this.prisma.brandPreset.findFirst({ where: { schoolId } });
    if (existing) return;

    const presets = this.getDefaultPresets();
    for (let i = 0; i < presets.length; i++) {
      await this.prisma.brandPreset.create({
        data: {
          schoolId,
          name: presets[i].name,
          palette: presets[i].palette as any,
          fonts: presets[i].fonts as any,
          logos: {},
          layout: presets[i].layout as any,
          isDefault: i === 0,
        },
      });
    }
  }
}
