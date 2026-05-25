import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DigitalStampService {
  constructor(private prisma: PrismaService) {}

  async getStamps(schoolId: string | null, type?: string) {
    if (!schoolId) return [];
    const where: any = { schoolId };
    if (type) where.type = type;
    return this.prisma.digitalStamp.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getStamp(schoolId: string, id: string) {
    const stamp = await this.prisma.digitalStamp.findFirst({ where: { id, schoolId } });
    if (!stamp) throw new NotFoundException('Digital stamp not found');
    return stamp;
  }

  async createStamp(
    schoolId: string,
    data: {
      name: string;
      type: string;
      shape?: string;
      imageUrl?: string;
      svgContent?: string;
      opacity?: number;
      width?: number;
      height?: number;
      isDefault?: boolean;
      createdBy?: string;
    },
  ) {
    if (data.isDefault) {
      await this.prisma.digitalStamp.updateMany({
        where: { schoolId, isDefault: true },
        data: { isDefault: false },
      });
    }

    let svgContent = data.svgContent;
    if (!svgContent) {
      svgContent = this.generateStampSvg(
        data.type || 'CUSTOM',
        data.shape || 'CIRCULAR',
        data.name,
        data.name,
        data.width || 150,
        data.height || 150,
      );
    }

    return this.prisma.digitalStamp.create({
      data: {
        schoolId,
        name: data.name,
        type: data.type as any,
        shape: (data.shape as any) || 'CIRCULAR',
        imageUrl: data.imageUrl,
        svgContent,
        opacity: data.opacity ?? 1.0,
        width: data.width || 150,
        height: data.height || 150,
        isDefault: data.isDefault || false,
        createdBy: data.createdBy,
      },
    });
  }

  async updateStamp(schoolId: string, id: string, data: any) {
    const stamp = await this.prisma.digitalStamp.findFirst({ where: { id, schoolId } });
    if (!stamp) throw new NotFoundException('Digital stamp not found');

    if (data.isDefault && !stamp.isDefault) {
      await this.prisma.digitalStamp.updateMany({
        where: { schoolId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    if (data.type || data.shape || data.name) {
      const svgContent = this.generateStampSvg(
        data.type || stamp.type,
        data.shape || stamp.shape,
        data.name || stamp.name,
        data.name || stamp.name,
        data.width || stamp.width,
        data.height || stamp.height,
      );
      data.svgContent = svgContent;
    }

    return this.prisma.digitalStamp.update({ where: { id }, data });
  }

  async deleteStamp(schoolId: string, id: string) {
    const stamp = await this.prisma.digitalStamp.findFirst({ where: { id, schoolId } });
    if (!stamp) throw new NotFoundException('Digital stamp not found');
    await this.prisma.templateStamp.deleteMany({ where: { stampId: id } });
    return this.prisma.digitalStamp.delete({ where: { id } });
  }

  async duplicateStamp(schoolId: string, id: string) {
    const original = await this.prisma.digitalStamp.findFirst({ where: { id, schoolId } });
    if (!original) throw new NotFoundException('Digital stamp not found');
    return this.prisma.digitalStamp.create({
      data: {
        schoolId,
        name: `${original.name} (Copy)`,
        type: original.type,
        shape: original.shape,
        imageUrl: original.imageUrl,
        svgContent: original.svgContent,
        opacity: original.opacity,
        width: original.width,
        height: original.height,
        metadata: original.metadata as any,
      },
    });
  }

  async assignStampToTemplate(
    schoolId: string,
    templateId: string,
    stampId: string,
    position?: {
      x: number;
      y: number;
      width?: number;
      height?: number;
      rotation?: number;
      opacity?: number;
      layerOrder?: number;
    },
  ) {
    const stamp = await this.prisma.digitalStamp.findFirst({ where: { id: stampId, schoolId } });
    if (!stamp) throw new NotFoundException('Digital stamp not found');

    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
    });
    if (!template) throw new NotFoundException('Report template not found');

    const existing = await this.prisma.templateStamp.findFirst({
      where: { templateId, stampId },
    });
    if (existing) {
      return this.prisma.templateStamp.update({
        where: { id: existing.id },
        data: {
          positionX: position?.x ?? existing.positionX,
          positionY: position?.y ?? existing.positionY,
          width: position?.width ?? stamp.width,
          height: position?.height ?? stamp.height,
          rotation: position?.rotation ?? 0,
          opacity: position?.opacity ?? stamp.opacity,
          layerOrder: position?.layerOrder ?? existing.layerOrder,
        },
        include: { stamp: true },
      });
    }

    const maxLayer = await this.prisma.templateStamp.findFirst({
      where: { templateId },
      orderBy: { layerOrder: 'desc' },
    });

    return this.prisma.templateStamp.create({
      data: {
        templateId,
        stampId,
        positionX: position?.x ?? 0,
        positionY: position?.y ?? 0,
        width: position?.width ?? stamp.width,
        height: position?.height ?? stamp.height,
        rotation: position?.rotation ?? 0,
        opacity: position?.opacity ?? stamp.opacity,
        layerOrder: position?.layerOrder ?? (maxLayer ? maxLayer.layerOrder + 1 : 0),
      },
      include: { stamp: true },
    });
  }

  async updateTemplateStamp(schoolId: string, templateStampId: string, data: any) {
    const ts = await this.prisma.templateStamp.findUnique({
      where: { id: templateStampId },
      include: { stamp: true, template: true },
    });
    if (!ts || ts.template.schoolId !== schoolId)
      throw new NotFoundException('Template stamp not found');
    return this.prisma.templateStamp.update({
      where: { id: templateStampId },
      data,
      include: { stamp: true },
    });
  }

  async removeTemplateStamp(schoolId: string, templateStampId: string) {
    const ts = await this.prisma.templateStamp.findUnique({
      where: { id: templateStampId },
      include: { template: true },
    });
    if (!ts || ts.template.schoolId !== schoolId)
      throw new NotFoundException('Template stamp not found');
    return this.prisma.templateStamp.delete({ where: { id: templateStampId } });
  }

  async getTemplateStamps(schoolId: string, templateId: string) {
    const template = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId, schoolId },
    });
    if (!template) throw new NotFoundException('Report template not found');
    return this.prisma.templateStamp.findMany({
      where: { templateId },
      include: { stamp: true },
      orderBy: { layerOrder: 'asc' },
    });
  }

  generateStampSvg(
    type: string,
    shape: string,
    text: string,
    name: string,
    width: number,
    height: number,
  ): string {
    const upperType = type.toUpperCase();

    switch (shape.toUpperCase()) {
      case 'CIRCULAR':
        return this.generateCircularSvg(upperType, text, name, width);
      case 'RECTANGULAR':
        return this.generateRectangularSvg(upperType, text, name, width, height);
      case 'SQUARE':
        return this.generateSquareSvg(upperType, text, name, width);
      case 'OVAL':
        return this.generateOvalSvg(upperType, text, name, width, height);
      default:
        return this.generateCircularSvg(upperType, text, name, width);
    }
  }

  private generateCircularSvg(
    type: string,
    text: string,
    _name: string,
    size: number,
  ): string {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    const innerR = r - 16;
    const fontSize = Math.max(8, Math.floor(r / 6));
    const innerFontSize = Math.max(10, Math.floor(r / 5));
    const accentColor = this.getAccentColor(type);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <path id="topArc" d="M ${cx - innerR + 4},${cy} A ${innerR - 4},${innerR - 4} 0 0,1 ${cx + innerR - 4},${cy}" fill="none"/>
    <path id="bottomArc" d="M ${cx - innerR + 8},${cy} A ${innerR - 8},${innerR - 8} 0 0,0 ${cx + innerR - 8},${cy}" fill="none"/>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${this.getBorderColor(type)}" stroke-width="2.5"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 7}" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="3,3"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${this.getBorderColor(type)}" stroke-width="1.5"/>
  <text font-size="${fontSize}" font-family="Arial, sans-serif" fill="${this.getTextColor(type)}" font-weight="bold" text-anchor="middle" letter-spacing="2">
    <textPath href="#topArc" startOffset="50%">${this.escapeXml(text)}</textPath>
  </text>
  <text x="${cx}" y="${cy - 10}" font-size="${innerFontSize}" font-family="Arial, sans-serif" fill="${accentColor}" font-weight="bold" text-anchor="middle">${type}</text>
  <polygon points="${cx - 12},${cy + 4} ${cx},${cy - 8} ${cx + 12},${cy + 4} ${cx},${cy + 16}" fill="${accentColor}" opacity="0.9"/>
  <text x="${cx}" y="${cy + 30}" font-size="${Math.max(6, fontSize - 4)}" font-family="Arial, sans-serif" fill="#666" text-anchor="middle">
    <textPath href="#bottomArc" startOffset="50%">${this.formatDate()}</textPath>
  </text>
</svg>`;
  }

  private generateRectangularSvg(
    type: string,
    text: string,
    _name: string,
    width: number,
    height: number,
  ): string {
    const accentColor = this.getAccentColor(type);
    const borderColor = this.getBorderColor(type);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="8" ry="8" fill="none" stroke="${borderColor}" stroke-width="2.5"/>
  <rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="6" ry="6" fill="none" stroke="${accentColor}" stroke-width="0.8" stroke-dasharray="4,3"/>
  <line x1="${Math.floor(width * 0.15)}" y1="${height / 2 - 6}" x2="${Math.floor(width * 0.85)}" y2="${height / 2 - 6}" stroke="${accentColor}" stroke-width="0.5" opacity="0.5"/>
  <line x1="${Math.floor(width * 0.15)}" y1="${height / 2 + 16}" x2="${Math.floor(width * 0.85)}" y2="${height / 2 + 16}" stroke="${accentColor}" stroke-width="0.5" opacity="0.5"/>
  <text x="${width / 2}" y="${height / 2 - 14}" font-size="${Math.max(10, Math.floor(height / 5))}" font-family="Arial, sans-serif" fill="${accentColor}" font-weight="bold" text-anchor="middle" letter-spacing="2">${type}</text>
  <text x="${width / 2}" y="${height / 2 + 10}" font-size="${Math.max(7, Math.floor(height / 8))}" font-family="Arial, sans-serif" fill="#333" text-anchor="middle">${this.escapeXml(text)}</text>
  <text x="${width / 2}" y="${height / 2 + 28}" font-size="${Math.max(6, Math.floor(height / 10))}" font-family="Arial, sans-serif" fill="#888" text-anchor="middle">${this.formatDate()}</text>
</svg>`;
  }

  private generateSquareSvg(type: string, text: string, _name: string, size: number): string {
    const accentColor = this.getAccentColor(type);
    const borderColor = this.getBorderColor(type);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="4" ry="4" fill="none" stroke="${borderColor}" stroke-width="2.5"/>
  <rect x="6" y="6" width="${size - 12}" height="${size - 12}" rx="3" ry="3" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="3,3"/>
  <line x1="${Math.floor(size * 0.2)}" y1="${size / 2 - 8}" x2="${Math.floor(size * 0.8)}" y2="${size / 2 - 8}" stroke="${accentColor}" stroke-width="0.5" opacity="0.4"/>
  <line x1="${Math.floor(size * 0.2)}" y1="${size / 2 + 18}" x2="${Math.floor(size * 0.8)}" y2="${size / 2 + 18}" stroke="${accentColor}" stroke-width="0.5" opacity="0.4"/>
  <text x="${size / 2}" y="${size / 2 - 16}" font-size="${Math.max(9, Math.floor(size / 6))}" font-family="Arial, sans-serif" fill="${accentColor}" font-weight="bold" text-anchor="middle" letter-spacing="2">${type}</text>
  <text x="${size / 2}" y="${size / 2 + 10}" font-size="${Math.max(6, Math.floor(size / 8))}" font-family="Arial, sans-serif" fill="#333" text-anchor="middle">${this.escapeXml(text)}</text>
  <text x="${size / 2}" y="${size / 2 + 28}" font-size="${Math.max(5, Math.floor(size / 10))}" font-family="Arial, sans-serif" fill="#888" text-anchor="middle">${this.formatDate()}</text>
</svg>`;
  }

  private generateOvalSvg(
    type: string,
    text: string,
    _name: string,
    width: number,
    height: number,
  ): string {
    const accentColor = this.getAccentColor(type);
    const borderColor = this.getBorderColor(type);
    const rx = width / 2 - 4;
    const ry = height / 2 - 4;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx}" ry="${ry}" fill="none" stroke="${borderColor}" stroke-width="2.5"/>
  <ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx - 6}" ry="${ry - 6}" fill="none" stroke="${accentColor}" stroke-width="0.8" stroke-dasharray="3,3"/>
  <line x1="${Math.floor(width * 0.2)}" y1="${height / 2 - 6}" x2="${Math.floor(width * 0.8)}" y2="${height / 2 - 6}" stroke="${accentColor}" stroke-width="0.5" opacity="0.5"/>
  <line x1="${Math.floor(width * 0.2)}" y1="${height / 2 + 14}" x2="${Math.floor(width * 0.8)}" y2="${height / 2 + 14}" stroke="${accentColor}" stroke-width="0.5" opacity="0.5"/>
  <text x="${width / 2}" y="${height / 2 - 14}" font-size="${Math.max(10, Math.floor(height / 5))}" font-family="Arial, sans-serif" fill="${accentColor}" font-weight="bold" text-anchor="middle" letter-spacing="2">${type}</text>
  <text x="${width / 2}" y="${height / 2 + 8}" font-size="${Math.max(6, Math.floor(height / 8))}" font-family="Arial, sans-serif" fill="#333" text-anchor="middle">${this.escapeXml(text)}</text>
  <text x="${width / 2}" y="${height / 2 + 26}" font-size="${Math.max(5, Math.floor(height / 10))}" font-family="Arial, sans-serif" fill="#888" text-anchor="middle">${this.formatDate()}</text>
</svg>`;
  }

  generateOfficialSchoolStampSvg(schoolName: string, width = 200, height = 200): string {
    const cx = width / 2;
    const cy = height / 2;
    const outerR = Math.min(cx, cy) - 4;
    const innerR = outerR - 18;
    const fontSize = Math.max(8, Math.floor(outerR / 5));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <path id="schoolTopArc" d="M ${cx - innerR + 6},${cy} A ${innerR - 6},${innerR - 6} 0 0,1 ${cx + innerR - 6},${cy}" fill="none"/>
    <path id="schoolBottomArc" d="M ${cx - innerR + 10},${cy} A ${innerR - 10},${innerR - 10} 0 0,0 ${cx + innerR - 10},${cy}" fill="none"/>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="#1a365d" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${outerR - 6}" fill="none" stroke="#c0a030" stroke-width="1.5"/>
  <circle cx="${cx}" cy="${cy}" r="${outerR - 9}" fill="none" stroke="#1a365d" stroke-width="1"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#c0a030" stroke-width="1.5"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR - 3}" fill="none" stroke="#1a365d" stroke-width="0.8" stroke-dasharray="2.5,2.5"/>
  <text font-size="${fontSize}" font-family="Georgia, 'Times New Roman', serif" fill="#1a365d" font-weight="bold" text-anchor="middle" letter-spacing="3">
    <textPath href="#schoolTopArc" startOffset="50%">${this.escapeXml(schoolName)}</textPath>
  </text>
  <text font-size="${Math.max(6, fontSize - 4)}" font-family="Arial, sans-serif" fill="#c0a030" font-weight="bold" text-anchor="middle" letter-spacing="1.5">
    <textPath href="#schoolBottomArc" startOffset="50%">OFFICIAL SCHOOL STAMP</textPath>
  </text>
  <polygon points="${cx - 18},${cy + 2} ${cx},${cy - 16} ${cx + 18},${cy + 2} ${cx + 10},${cy + 2} ${cx + 10},${cy + 14} ${cx - 10},${cy + 14} ${cx - 10},${cy + 2} ${cx - 18},${cy + 2}" fill="#1a365d" opacity="0.95"/>
  <circle cx="${cx}" cy="${cy - 5}" r="3" fill="#c0a030"/>
  <text x="${cx}" y="${cy + 28}" font-size="${Math.max(6, fontSize - 5)}" font-family="Arial, sans-serif" fill="#666" text-anchor="middle">${this.formatDate()}</text>
  ${this.generateDotRing(cx, cy, innerR - 6, 16)}
</svg>`;
  }

  private generateDotRing(cx: number, cy: number, r: number, count: number): string {
    let dots = '';
    for (let i = 0; i < count; i++) {
      const angle = (i * 360) / count;
      const rad = (angle * Math.PI) / 180;
      const dx = cx + r * Math.cos(rad);
      const dy = cy + r * Math.sin(rad);
      dots += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="1.5" fill="#1a365d" opacity="0.6"/>`;
    }
    return dots;
  }

  generateDateStampSvg(): string {
    const width = 180;
    const height = 50;
    const dateStr = this.formatDate();

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="4" ry="4" fill="none" stroke="#333" stroke-width="2"/>
  <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="2" ry="2" fill="none" stroke="#666" stroke-width="0.5"/>
  <text x="${width / 2}" y="${height / 2 + 5}" font-size="16" font-family="'Courier New', monospace" fill="#333" font-weight="bold" text-anchor="middle">${dateStr}</text>
</svg>`;
  }

  generateVerificationHash(documentId: string, schoolId: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${documentId}:${schoolId}:${crypto.randomBytes(16).toString('hex')}:${Date.now()}`)
      .digest('hex');
    return hash;
  }

  async createStampVerification(data: {
    documentId: string;
    documentType: string;
    schoolId: string;
    stampId?: string;
    metadata?: any;
  }) {
    const verificationHash = this.generateVerificationHash(data.documentId, data.schoolId);
    const qrCodeDataUrl = `https://verify.smarttech.africa/verify/${verificationHash}`;

    return this.prisma.stampVerification.create({
      data: {
        documentId: data.documentId,
        documentType: data.documentType,
        schoolId: data.schoolId,
        stampId: data.stampId,
        verificationHash,
        verificationUrl: qrCodeDataUrl,
        qrCodeDataUrl,
        metadata: data.metadata || {},
      },
    });
  }

  async verifyDocument(verificationHash: string) {
    const record = await this.prisma.stampVerification.findUnique({
      where: { verificationHash },
    });
    if (!record) throw new NotFoundException('Verification record not found');

    if (!record.verifiedAt) {
      return this.prisma.stampVerification.update({
        where: { id: record.id },
        data: { verifiedAt: new Date() },
      });
    }

    return record;
  }

  async getVerificationStatus(documentId: string) {
    const records = await this.prisma.stampVerification.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => ({
      id: r.id,
      documentId: r.documentId,
      documentType: r.documentType,
      verified: r.verifiedAt !== null,
      verifiedAt: r.verifiedAt,
      createdAt: r.createdAt,
    }));
  }

  getStampHtml(stamp: any, templateStamp: any): string {
    const svgContent = stamp.svgContent || '';
    const opacity = templateStamp?.opacity ?? stamp.opacity ?? 1;
    const rotation = templateStamp?.rotation ?? 0;
    const x = templateStamp?.positionX ?? 0;
    const y = templateStamp?.positionY ?? 0;
    const w = templateStamp?.width ?? stamp.width ?? 150;
    const h = templateStamp?.height ?? stamp.height ?? 150;

    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;opacity:${opacity};transform:rotate(${rotation}deg);transform-origin:center;pointer-events:none;">
  ${svgContent}
</div>`;
  }

  getStampSvgOverlay(stamps: any[]): string {
    if (!stamps || stamps.length === 0) return '';

    const parts = stamps.map((s, i) => {
      const svgContent = s.stamp?.svgContent || s.svgContent || '';
      const templateStamp = s;
      const opacity = templateStamp?.opacity ?? 1;
      const rotation = templateStamp?.rotation ?? 0;
      const x = templateStamp?.positionX ?? 0;
      const y = templateStamp?.positionY ?? 0;
      const w = templateStamp?.width ?? 150;
      const h = templateStamp?.height ?? 150;

      return `<g transform="translate(${x},${y}) rotate(${rotation},${w / 2},${h / 2})" opacity="${opacity}">
  ${svgContent.replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '')}
</g>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;">
${parts.join('\n')}
</svg>`;
  }

  async getDefaultStamps(schoolId: string) {
    const existing = await this.prisma.digitalStamp.findFirst({
      where: { schoolId, isDefault: true },
    });
    if (existing) return existing;

    const now = new Date();
    const stamps = [
      {
        name: 'Official School Stamp',
        type: 'OFFICIAL_SCHOOL',
        shape: 'CIRCULAR',
        width: 200,
        height: 200,
        isDefault: true,
        svgContent: this.generateOfficialSchoolStampSvg('SCHOOL NAME'),
      },
      {
        name: 'Approved',
        type: 'APPROVED',
        shape: 'RECTANGULAR',
        width: 160,
        height: 70,
        isDefault: false,
        svgContent: this.generateRectangularSvg(
          'APPROVED', 'APPROVED', 'Approved', 160, 70,
        ),
      },
      {
        name: 'Verified',
        type: 'VERIFIED',
        shape: 'CIRCULAR',
        width: 140,
        height: 140,
        isDefault: false,
        svgContent: this.generateCircularSvg('VERIFIED', 'VERIFIED', 'Verified', 140),
      },
      {
        name: 'Paid',
        type: 'PAID',
        shape: 'RECTANGULAR',
        width: 150,
        height: 65,
        isDefault: false,
        svgContent: this.generateRectangularSvg(
          'PAID', 'PAID', 'Paid', 150, 65,
        ),
      },
      {
        name: 'Confidential',
        type: 'CONFIDENTIAL',
        shape: 'RECTANGULAR',
        width: 170,
        height: 60,
        isDefault: false,
        svgContent: this.generateConfidentialSvg(),
      },
    ];

    const created = [];
    for (const stamp of stamps) {
      const s = await this.prisma.digitalStamp.create({
        data: {
          schoolId,
          name: stamp.name,
          type: stamp.type as any,
          shape: stamp.shape as any,
          width: stamp.width,
          height: stamp.height,
          svgContent: stamp.svgContent,
          isDefault: stamp.isDefault,
          createdAt: now,
        },
      });
      created.push(s);
    }

    return created;
  }

  private generateConfidentialSvg(): string {
    const width = 170;
    const height = 60;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <pattern id="confidentialStripes" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(-35)">
      <line x1="0" y1="0" x2="0" y2="12" stroke="#d32f2f" stroke-width="2" opacity="0.15"/>
    </pattern>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="4" ry="4" fill="url(#confidentialStripes)" stroke="#d32f2f" stroke-width="2.5"/>
  <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="3" ry="3" fill="none" stroke="#b71c1c" stroke-width="0.8" stroke-dasharray="3,3"/>
  <text x="${width / 2}" y="${height / 2 - 4}" font-size="16" font-family="Arial, sans-serif" fill="#d32f2f" font-weight="bold" text-anchor="middle" letter-spacing="3">CONFIDENTIAL</text>
  <text x="${width / 2}" y="${height / 2 + 14}" font-size="7" font-family="Arial, sans-serif" fill="#b71c1c" text-anchor="middle">${this.formatDate()}</text>
</svg>`;
  }

  private getAccentColor(type: string): string {
    switch (type.toUpperCase()) {
      case 'APPROVED':
      case 'PAID':
        return '#2e7d32';
      case 'VERIFIED':
        return '#1565c0';
      case 'CONFIDENTIAL':
        return '#d32f2f';
      case 'OFFICIAL_SCHOOL':
        return '#c0a030';
      case 'PRINCIPAL':
        return '#4a148c';
      case 'EXAMINATION':
        return '#e65100';
      case 'REGISTRAR':
        return '#00695c';
      case 'MINISTRY':
        return '#1a237e';
      case 'DEPARTMENT':
        return '#37474f';
      case 'REGISTRATION_BOARD':
        return '#004d40';
      default:
        return '#333333';
    }
  }

  private getBorderColor(type: string): string {
    switch (type.toUpperCase()) {
      case 'APPROVED':
      case 'PAID':
        return '#1b5e20';
      case 'VERIFIED':
        return '#0d47a1';
      case 'CONFIDENTIAL':
        return '#b71c1c';
      case 'OFFICIAL_SCHOOL':
        return '#1a365d';
      case 'PRINCIPAL':
        return '#311b92';
      case 'EXAMINATION':
        return '#bf360c';
      case 'REGISTRAR':
        return '#004d40';
      case 'MINISTRY':
        return '#0d1430';
      case 'DEPARTMENT':
        return '#263238';
      case 'REGISTRATION_BOARD':
        return '#00251a';
      default:
        return '#555555';
    }
  }

  private getTextColor(type: string): string {
    const upper = type.toUpperCase();
    if (['OFFICIAL_SCHOOL', 'MINISTRY', 'REGISTRATION_BOARD'].includes(upper)) return '#1a365d';
    if (['PRINCIPAL', 'REGISTRAR', 'DEPARTMENT'].includes(upper)) return '#37474f';
    return '#333333';
  }

  private formatDate(): string {
    const d = new Date();
    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
    ];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${mm} ${yyyy}`;
  }

  private escapeXml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
