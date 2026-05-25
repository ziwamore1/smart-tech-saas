import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandingPresetService {
  constructor(private prisma: PrismaService) {}

  async getPresets(schoolId: string | null) {
    if (!schoolId) return this.getDefaultPresets();
    return this.prisma.brandPreset.findMany({ where: { schoolId }, orderBy: { updatedAt: 'desc' } });
  }

  async getPreset(schoolId: string | null, id: string) {
    const where = schoolId ? { id, schoolId } : { id };
    const p = await this.prisma.brandPreset.findFirst({ where });
    if (!p) throw new NotFoundException('Brand preset not found');
    return p;
  }

  async createPreset(schoolId: string, data: { name: string; palette?: any; fonts?: any; logos?: any; layout?: any; metadata?: any; isDefault?: boolean }) {
    if (!schoolId) throw new NotFoundException('School ID required');
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
    const where = schoolId ? { id, schoolId } : { id };
    const p = await this.prisma.brandPreset.findFirst({ where });
    if (!p) throw new NotFoundException('Brand preset not found');
    if (data.isDefault && !p.isDefault && schoolId) {
      await this.prisma.brandPreset.updateMany({ where: { schoolId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    }
    return this.prisma.brandPreset.update({ where: { id }, data });
  }

  async deletePreset(schoolId: string, id: string) {
    const where = schoolId ? { id, schoolId } : { id };
    const p = await this.prisma.brandPreset.findFirst({ where });
    if (!p) throw new NotFoundException('Brand preset not found');
    return this.prisma.brandPreset.delete({ where: { id } });
  }

  async applyPresetToTemplate(schoolId: string, templateId: string, presetId: string) {
    if (!schoolId) throw new NotFoundException('School ID required');
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
        primaryColor: palette.primary || palette.accent1 || t.primaryColor,
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
        id: 'default-classic',
        name: 'Classic School',
        palette: {
          dark1: '#1a1a2e', light1: '#ffffff',
          dark2: '#1a365d', light2: '#ebf4ff',
          accent1: '#3b82f6', accent2: '#10b981', accent3: '#f59e0b',
          accent4: '#ef4444', accent5: '#8b5cf6', accent6: '#ec4899',
          hyperlink: '#2563eb', followedHyperlink: '#7c3aed',
        },
        fonts: { heading: 'Georgia', body: 'Arial', title: 'Georgia' },
        layout: { margins: { top: 15, bottom: 15, left: 15, right: 15 }, spacing: 'normal' },
      },
      {
        id: 'default-modern-academy',
        name: 'Modern Academy',
        palette: {
          dark1: '#0f172a', light1: '#ffffff',
          dark2: '#0f766e', light2: '#f0fdfa',
          accent1: '#14b8a6', accent2: '#3b82f6', accent3: '#f59e0b',
          accent4: '#ef4444', accent5: '#8b5cf6', accent6: '#ec4899',
          hyperlink: '#0d9488', followedHyperlink: '#6d28d9',
        },
        fonts: { heading: 'Helvetica', body: 'Arial', title: 'Helvetica' },
        layout: { margins: { top: 20, bottom: 20, left: 20, right: 20 }, spacing: 'wide' },
      },
      {
        id: 'default-premium-gold',
        name: 'Premium Gold',
        palette: {
          dark1: '#451a03', light1: '#fffbeb',
          dark2: '#92400e', light2: '#fef3c7',
          accent1: '#b8860b', accent2: '#d97706', accent3: '#f59e0b',
          accent4: '#dc2626', accent5: '#7c3aed', accent6: '#db2777',
          hyperlink: '#92400e', followedHyperlink: '#6d28d9',
        },
        fonts: { heading: 'Times New Roman', body: 'Georgia', title: 'Times New Roman' },
        layout: { margins: { top: 20, bottom: 20, left: 25, right: 25 }, spacing: 'elegant' },
      },
      {
        id: 'default-clean-green',
        name: 'Clean Green',
        palette: {
          dark1: '#14532d', light1: '#f0fdf4',
          dark2: '#166534', light2: '#dcfce7',
          accent1: '#22c55e', accent2: '#16a34a', accent3: '#f59e0b',
          accent4: '#ef4444', accent5: '#6366f1', accent6: '#ec4899',
          hyperlink: '#15803d', followedHyperlink: '#7c3aed',
        },
        fonts: { heading: 'Verdana', body: 'Arial', title: 'Verdana' },
        layout: { margins: { top: 15, bottom: 15, left: 18, right: 18 }, spacing: 'normal' },
      },
      {
        id: 'default-modern-dark',
        name: 'Modern Dark',
        palette: {
          dark1: '#020617', light1: '#f8fafc',
          dark2: '#1e293b', light2: '#e2e8f0',
          accent1: '#3b82f6', accent2: '#10b981', accent3: '#f59e0b',
          accent4: '#ef4444', accent5: '#8b5cf6', accent6: '#ec4899',
          hyperlink: '#60a5fa', followedHyperlink: '#a78bfa',
        },
        fonts: { heading: 'Helvetica', body: 'Arial', title: 'Helvetica' },
        layout: { margins: { top: 15, bottom: 15, left: 15, right: 15 }, spacing: 'compact' },
      },
      {
        id: 'default-minimal-gray',
        name: 'Minimal Gray',
        palette: {
          dark1: '#111827', light1: '#ffffff',
          dark2: '#374151', light2: '#f3f4f6',
          accent1: '#6366f1', accent2: '#3b82f6', accent3: '#10b981',
          accent4: '#f59e0b', accent5: '#ef4444', accent6: '#8b5cf6',
          hyperlink: '#4f46e5', followedHyperlink: '#7c3aed',
        },
        fonts: { heading: 'Arial', body: 'Arial', title: 'Arial' },
        layout: { margins: { top: 20, bottom: 20, left: 20, right: 20 }, spacing: 'normal' },
      },
    ];
  }

  async seedDefaultPresets(schoolId: string) {
    if (!schoolId) return;
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
