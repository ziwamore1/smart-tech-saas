import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

@Injectable()
export class CertificateRendererService {
  generateStampOverlayHtml(stamps: any[]): string {
    if (!stamps || stamps.length === 0) return '';

    const parts = stamps.map((s) => {
      const svgContent = s.stamp?.svgContent || s.svgContent || '';
      if (!svgContent) return '';

      const opacity = s.opacity ?? s.stamp?.opacity ?? 1;
      const rotation = s.rotation ?? 0;
      const x = s.positionX ?? 0;
      const y = s.positionY ?? 0;
      const w = s.width ?? s.stamp?.width ?? 150;
      const h = s.height ?? s.stamp?.height ?? 150;

      const innerSvg = svgContent
        .replace(/<svg[^>]*>/i, '')
        .replace(/<\/svg>/i, '');

      return `<g transform="translate(${x},${y}) rotate(${rotation},${w / 2},${h / 2})" opacity="${opacity}">
  ${innerSvg}
</g>`;
    });

    if (parts.length === 0) return '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;z-index:10;">
${parts.join('\n')}
</svg>`;
  }
  async generateQrCodeDataUrl(data: string): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch {
      return '';
    }
  }

  async generateQrSvg(data: string): Promise<string> {
    try {
      return await QRCode.toString(data, {
        type: 'svg',
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      });
    } catch {
      return '<svg></svg>';
    }
  }

  async optimizeImage(
    input: Buffer | string,
    options?: { width?: number; height?: number; format?: 'jpeg' | 'png' | 'webp'; quality?: number },
  ): Promise<Buffer> {
    const opts = {
      width: options?.width || 300,
      height: options?.height,
      format: options?.format || 'png',
      quality: options?.quality || 85,
    };

    let pipeline = sharp(input);
    if (opts.width) pipeline = pipeline.resize(opts.width, opts.height, { fit: 'inside', withoutEnlargement: true });
    pipeline = pipeline[opts.format]({ quality: opts.quality });
    return pipeline.toBuffer();
  }

  async generateCertificateNumber(
    templateName: string,
    sequence: number,
    prefix?: string,
  ): Promise<string> {
    const p = prefix || templateName.substring(0, 3).toUpperCase();
    const padded = String(sequence).padStart(6, '0');
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${p}-${padded}-${random}`;
  }

  async createVerificationUrl(baseUrl: string, certificateId: string): Promise<string> {
    const token = crypto.createHash('sha256').update(certificateId + 'smarttech-secret').digest('hex').substring(0, 16);
    return `${baseUrl}/verify/${certificateId}?token=${token}`;
  }

  generateBorderSvg(
    width: number,
    height: number,
    style: string = 'classic',
    color: string = '#1a365d',
  ): string {
    const w = width;
    const h = height;
    const m = 20;

    switch (style) {
      case 'classic':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="3" rx="4"/>
          <rect x="${m + 8}" y="${m + 8}" width="${w - 2 * m - 16}" height="${h - 2 * m - 16}" fill="none" stroke="${color}" stroke-width="1.5" rx="2"/>
          <rect x="${m + 14}" y="${m + 14}" width="${w - 2 * m - 28}" height="${h - 2 * m - 28}" fill="none" stroke="${color}" stroke-width="0.5" rx="1"/>
        </svg>`;
      case 'modern':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="2"/>
          <line x1="${m + 40}" y1="${m}" x2="${w - m - 40}" y2="${m}" stroke="${color}" stroke-width="4"/>
          <line x1="${m + 40}" y1="${h - m}" x2="${w - m - 40}" y2="${h - m}" stroke="${color}" stroke-width="4"/>
        </svg>`;
      case 'elegant':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs><filter id="s1"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${color}" flood-opacity="0.15"/></filter></defs>
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="1" filter="url(#s1)"/>
          <rect x="${m + 6}" y="${m + 6}" width="${w - 2 * m - 12}" height="${h - 2 * m - 12}" fill="none" stroke="${color}" stroke-width="0.5"/>
        </svg>`;
      case 'ornate':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="4" rx="8"/>
          <rect x="${m + 10}" y="${m + 10}" width="${w - 2 * m - 20}" height="${h - 2 * m - 20}" fill="none" stroke="${color}" stroke-width="1.5" rx="4" stroke-dasharray="8,4"/>
          <circle cx="${m + 25}" cy="${m + 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${w - m - 25}" cy="${m + 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${m + 25}" cy="${h - m - 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${w - m - 25}" cy="${h - m - 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
        </svg>`;
      case 'minimal':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m + 10}" y="${m + 10}" width="${w - 2 * m - 20}" height="${h - 2 * m - 20}" fill="none" stroke="${color}" stroke-width="1"/>
        </svg>`;
      case 'gold':
        const gold1 = '#b8860b';
        const gold2 = '#ffd700';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${gold1};stop-opacity:1"/>
              <stop offset="50%" style="stop-color:${gold2};stop-opacity:1"/>
              <stop offset="100%" style="stop-color:${gold1};stop-opacity:1"/>
            </linearGradient>
          </defs>
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="url(#goldGrad)" stroke-width="3" rx="6"/>
          <rect x="${m + 8}" y="${m + 8}" width="${w - 2 * m - 16}" height="${h - 2 * m - 16}" fill="none" stroke="url(#goldGrad)" stroke-width="1" rx="3"/>
        </svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="2"/>
        </svg>`;
    }
  }

  generateBadgeSvg(style: string = 'star', color: string = '#f59e0b'): string {
    const size = 60;
    switch (style) {
      case 'star':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <polygon points="${size / 2},4 ${size * 0.65},${size * 0.35} ${size},${size * 0.38} ${size * 0.73},${size * 0.6} ${size * 0.8},${size} ${size / 2},${size * 0.77} ${size * 0.2},${size} ${size * 0.27},${size * 0.6} 0,${size * 0.38} ${size * 0.35},${size * 0.35}" fill="${color}" stroke="${color}" stroke-width="1"/>
        </svg>`;
      case 'shield':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <path d="M${size / 2},2 L2,${size * 0.2} L2,${size * 0.5} Q2,${size * 0.75} ${size / 2},${size} Q${size - 2},${size * 0.75} ${size - 2},${size * 0.5} L${size - 2},${size * 0.2} Z" fill="${color}"/>
          <text x="${size / 2}" y="${size * 0.45}" text-anchor="middle" fill="white" font-size="${size * 0.4}" font-weight="bold">★</text>
        </svg>`;
      case 'circle':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}"/>
          <text x="${size / 2}" y="${size * 0.58}" text-anchor="middle" fill="white" font-size="${size * 0.5}" font-weight="bold">★</text>
        </svg>`;
      case 'trophy':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <path d="M${size * 0.25},2 L${size * 0.25},${size * 0.4} Q${size * 0.15},${size * 0.45} ${size * 0.1},${size * 0.55} L${size * 0.1},${size * 0.65} L${size * 0.3},${size * 0.65} Q${size * 0.35},${size * 0.75} ${size * 0.45},${size * 0.85} L${size * 0.45},${size - 2} L${size * 0.25},${size - 2} L${size * 0.25},${size} L${size * 0.75},${size} L${size * 0.75},${size - 2} L${size * 0.55},${size - 2} L${size * 0.55},${size * 0.85} Q${size * 0.65},${size * 0.75} ${size * 0.7},${size * 0.65} L${size * 0.9},${size * 0.65} L${size * 0.9},${size * 0.55} Q${size * 0.85},${size * 0.45} ${size * 0.75},${size * 0.4} L${size * 0.75},2 Z" fill="${color}" opacity="0.9"/>
          <rect x="${size * 0.35}" y="2" width="${size * 0.3}" height="${size * 0.35}" fill="white" opacity="0.3" rx="2"/>
        </svg>`;
      default:
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}"/>
        </svg>`;
    }
  }

  generateSealSvg(color: string = '#1a365d', text: string = 'VERIFIED'): string {
    const s = 100;
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
      <circle cx="${s / 2}" cy="${s / 2}" r="${s / 2 - 2}" fill="none" stroke="${color}" stroke-width="2"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.42}" fill="none" stroke="${color}" stroke-width="1"/>
      <text x="${s / 2}" y="${s * 0.45}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-weight="bold" fill="${color}">${text}</text>
      <text x="${s / 2}" y="${s * 0.58}" text-anchor="middle" font-size="6" fill="${color}">★</text>
      <circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.3}" fill="none" stroke="${color}" stroke-width="0.5" stroke-dasharray="3,2"/>
    </svg>`;
  }

  async generateCertificateHtml(
    canvasJson: any,
    data: {
      schoolName: string;
      studentName: string;
      className: string;
      termName: string;
      academicYear: string;
      certificateNumber: string;
      verificationUrl?: string;
      schoolLogo?: string;
      studentPhoto?: string;
      signature1Name?: string;
      signature1Label?: string;
      signature2Name?: string;
      signature2Label?: string;
      awardText?: string;
      borderStyle?: string;
      borderColor?: string;
      showQrCode?: boolean;
      showBadge?: boolean;
      badgeStyle?: string;
      showWatermark?: boolean;
      watermarkText?: string;
      orientation?: string;
      pageSize?: string;
      stamps?: any[];
    },
  ): Promise<string> {
    const isLandscape = data.orientation === 'landscape';
    const pageW = isLandscape ? '297mm' : '210mm';
    const pageH = isLandscape ? '210mm' : '297mm';

    let qrSvg = '';
    if (data.showQrCode && data.verificationUrl) {
      qrSvg = await this.generateQrSvg(data.verificationUrl);
    }

    const stampOverlay = data.stamps ? this.generateStampOverlayHtml(data.stamps) : '';

    const borderSvg = this.generateBorderSvg(760, isLandscape ? 520 : 720, data.borderStyle, data.borderColor);
    const badgeSvg = data.showBadge ? this.generateBadgeSvg(data.badgeStyle) : '';
    const sealSvg = this.generateSealSvg(data.borderColor);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Certificate - ${data.studentName}</title>
  <style>
    @page { size: ${data.pageSize || 'A4'} ${isLandscape ? 'landscape' : 'portrait'}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', 'Times New Roman', serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cert-page { width: 100%; min-height: ${pageH}; position: relative; display: flex; align-items: center; justify-content: center; background: white; overflow: hidden; }
    .cert-inner { position: relative; width: 90%; max-width: 720px; min-height: ${isLandscape ? '480px' : '680px'}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; z-index: 1; }
    .border-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
    .border-layer svg { width: 100%; height: 100%; }
    ${data.showWatermark ? `.watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 80px; color: ${data.borderColor}; opacity: 0.04; pointer-events: none; white-space: nowrap; font-weight: bold; z-index: 0; }` : ''}
    .logo-area { margin-bottom: 8px; z-index: 1; }
    .logo-area img { height: 60px; object-fit: contain; }
    .school-name { font-size: 24px; font-weight: bold; color: ${data.borderColor}; margin-bottom: 4px; z-index: 1; text-align: center; }
    .cert-title { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 8px; z-index: 1; }
    .divider { width: 180px; height: 1px; background: ${data.borderColor}; margin: 12px auto; opacity: 0.5; z-index: 1; }
    .award-text { font-size: 14px; color: #666; margin: 8px 0; z-index: 1; text-align: center; }
    .student-name { font-size: 32px; font-weight: bold; color: ${data.borderColor}; margin: 6px 0; font-family: 'Georgia', serif; z-index: 1; text-align: center; }
    .detail-text { font-size: 12px; color: #777; margin: 4px 0; z-index: 1; text-align: center; }
    .badge-area { margin: 12px 0; z-index: 1; }
    .photo-area { margin: 8px 0; z-index: 1; }
    .photo-area img { width: 70px; height: 70px; border-radius: 50%; object-fit: cover; border: 2px solid ${data.borderColor}; }
    .qr-area { margin: 8px 0; z-index: 1; }
    .qr-area svg { width: 60px; height: 60px; }
    .signatures { display: flex; justify-content: space-around; width: 85%; margin-top: 20px; z-index: 1; }
    .sig-box { text-align: center; width: 200px; }
    .sig-line { border-top: 1px solid #555; width: 100%; margin-bottom: 4px; padding-top: 6px; }
    .sig-label { font-size: 10px; color: #888; }
    .sig-name { font-size: 11px; color: #333; font-weight: bold; }
    .cert-number { font-size: 9px; color: #aaa; margin-top: 12px; z-index: 1; }
    @media print { .cert-page { margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="cert-page">
    <div class="border-layer">${borderSvg}</div>
    ${stampOverlay ? `<div class="stamp-layer">${stampOverlay}</div>` : ''}
    ${data.showWatermark ? `<div class="watermark">${data.watermarkText || 'CERTIFICATE'}</div>` : ''}
    <div class="cert-inner">
      ${data.schoolLogo ? `<div class="logo-area"><img src="${data.schoolLogo}" alt="School Logo"/></div>` : ''}
      <div class="school-name">${data.schoolName}</div>
      <div class="cert-title">Certificate of Achievement</div>
      <div class="divider"></div>
      <div class="award-text">${data.awardText || 'This certificate is awarded to'}</div>
      <div class="student-name">${data.studentName}</div>
      ${data.studentPhoto ? `<div class="photo-area"><img src="${data.studentPhoto}" alt="Student"/></div>` : ''}
      <div class="detail-text">For outstanding academic performance</div>
      <div class="detail-text">${data.className ? `Class: ${data.className} | ` : ''}${data.termName} ${data.academicYear}</div>
      ${badgeSvg ? `<div class="badge-area">${badgeSvg}</div>` : ''}
      ${qrSvg ? `<div class="qr-area">${qrSvg}</div>` : ''}
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${data.signature1Name || ''}</div>
          <div class="sig-label">${data.signature1Label || 'Head Teacher'}</div>
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${data.signature2Name || ''}</div>
          <div class="sig-label">${data.signature2Label || 'Director'}</div>
        </div>
      </div>
      <div class="cert-number">Certificate No: ${data.certificateNumber}</div>
    </div>
  </div>
</body>
</html>`;
  }
}
