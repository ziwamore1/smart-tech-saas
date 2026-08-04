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

  private generateCornerOrnament(x: number, y: number, color: string, flipH = false, flipV = false): string {
    const sx = flipH ? -1 : 1;
    const sy = flipV ? -1 : 1;
    return `<g transform="translate(${x},${y}) scale(${sx},${sy})">
      <path d="M0,0 L0,-30 Q0,-40 10,-40 L10,-35 Q4,-35 4,-30 L4,0 Z" fill="${color}" opacity="0.25"/>
      <path d="M5,-20 L0,-20 M10,-10 L10,-15" stroke="${color}" stroke-width="1" fill="none" opacity="0.4"/>
      <circle cx="8" cy="-8" r="3" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.3"/>
    </g>`;
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

    const cornerL = this.generateCornerOrnament(m + 5, m + 5, color);
    const cornerR = this.generateCornerOrnament(w - m - 5, m + 5, color, true);
    const cornerBL = this.generateCornerOrnament(m + 5, h - m - 5, color, false, true);
    const cornerBR = this.generateCornerOrnament(w - m - 5, h - m - 5, color, true, true);

    switch (style) {
      case 'classic':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="3" rx="4"/>
          <rect x="${m + 8}" y="${m + 8}" width="${w - 2 * m - 16}" height="${h - 2 * m - 16}" fill="none" stroke="${color}" stroke-width="1.5" rx="2"/>
          <rect x="${m + 14}" y="${m + 14}" width="${w - 2 * m - 28}" height="${h - 2 * m - 28}" fill="none" stroke="${color}" stroke-width="0.5" rx="1"/>
          ${cornerL}${cornerR}${cornerBL}${cornerBR}
        </svg>`;
      case 'modern':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="2"/>
          <line x1="${m + 40}" y1="${m}" x2="${w - m - 40}" y2="${m}" stroke="${color}" stroke-width="4"/>
          <line x1="${m + 40}" y1="${h - m}" x2="${w - m - 40}" y2="${h - m}" stroke="${color}" stroke-width="4"/>
          <line x1="${m}" y1="${m + 40}" x2="${m}" y2="${h - m - 40}" stroke="${color}" stroke-width="4"/>
          <line x1="${w - m}" y1="${m + 40}" x2="${w - m}" y2="${h - m - 40}" stroke="${color}" stroke-width="4"/>
        </svg>`;
      case 'elegant':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <filter id="s1"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${color}" flood-opacity="0.15"/></filter>
            <linearGradient id="elGrad" x1="0" y1="0" x2="${w}" y2="${h}">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.1"/>
              <stop offset="100%" stop-color="${color}" stop-opacity="0.05"/>
            </linearGradient>
          </defs>
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="url(#elGrad)" stroke="${color}" stroke-width="1" filter="url(#s1)"/>
          <rect x="${m + 6}" y="${m + 6}" width="${w - 2 * m - 12}" height="${h - 2 * m - 12}" fill="none" stroke="${color}" stroke-width="0.5" rx="2"/>
          <rect x="${m + 12}" y="${m + 12}" width="${w - 2 * m - 24}" height="${h - 2 * m - 24}" fill="none" stroke="${color}" stroke-width="0.3" rx="1" stroke-dasharray="2,3"/>
        </svg>`;
      case 'ornate':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <pattern id="ornatePattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="${color}" opacity="0.08"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${w}" height="${h}" fill="url(#ornatePattern)"/>
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="4" rx="8"/>
          <rect x="${m + 10}" y="${m + 10}" width="${w - 2 * m - 20}" height="${h - 2 * m - 20}" fill="none" stroke="${color}" stroke-width="1.5" rx="4" stroke-dasharray="8,4"/>
          <circle cx="${m + 25}" cy="${m + 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${m + 25}" cy="${m + 25}" r="6" fill="${color}" opacity="0.15"/>
          <circle cx="${w - m - 25}" cy="${m + 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${w - m - 25}" cy="${m + 25}" r="6" fill="${color}" opacity="0.15"/>
          <circle cx="${m + 25}" cy="${h - m - 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${m + 25}" cy="${h - m - 25}" r="6" fill="${color}" opacity="0.15"/>
          <circle cx="${w - m - 25}" cy="${h - m - 25}" r="10" fill="none" stroke="${color}" stroke-width="1"/>
          <circle cx="${w - m - 25}" cy="${h - m - 25}" r="6" fill="${color}" opacity="0.15"/>
          <rect x="${m + 40}" y="${m + 40}" width="${w - 2 * m - 80}" height="${h - 2 * m - 80}" fill="none" stroke="${color}" stroke-width="0.3" rx="2"/>
        </svg>`;
      case 'minimal':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m + 10}" y="${m + 10}" width="${w - 2 * m - 20}" height="${h - 2 * m - 20}" fill="none" stroke="${color}" stroke-width="1"/>
          <rect x="${m + 14}" y="${m + 14}" width="${w - 2 * m - 28}" height="${h - 2 * m - 28}" fill="none" stroke="${color}" stroke-width="0.3" stroke-dasharray="2,4"/>
        </svg>`;
      case 'gold':
        const gold1 = '#b8860b';
        const gold2 = '#ffd700';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${gold1};stop-opacity:1"/>
              <stop offset="25%" style="stop-color:${gold2};stop-opacity:1"/>
              <stop offset="50%" style="stop-color:#f0c040;stop-opacity:1"/>
              <stop offset="75%" style="stop-color:${gold2};stop-opacity:1"/>
              <stop offset="100%" style="stop-color:${gold1};stop-opacity:1"/>
            </linearGradient>
            <linearGradient id="goldInner" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#996515;stop-opacity:0.5"/>
              <stop offset="50%" style="stop-color:${gold2};stop-opacity:0.3"/>
              <stop offset="100%" style="stop-color:#996515;stop-opacity:0.5"/>
            </linearGradient>
          </defs>
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="url(#goldGrad)" stroke-width="4" rx="6"/>
          <rect x="${m + 7}" y="${m + 7}" width="${w - 2 * m - 14}" height="${h - 2 * m - 14}" fill="url(#goldInner)" stroke="url(#goldGrad)" stroke-width="1" rx="4"/>
          <rect x="${m + 12}" y="${m + 12}" width="${w - 2 * m - 24}" height="${h - 2 * m - 24}" fill="none" stroke="url(#goldGrad)" stroke-width="0.5" rx="3" stroke-dasharray="4,3"/>
          <circle cx="${m + 30}" cy="${m + 30}" r="4" fill="${gold2}" opacity="0.4"/>
          <circle cx="${w - m - 30}" cy="${m + 30}" r="4" fill="${gold2}" opacity="0.4"/>
          <circle cx="${m + 30}" cy="${h - m - 30}" r="4" fill="${gold2}" opacity="0.4"/>
          <circle cx="${w - m - 30}" cy="${h - m - 30}" r="4" fill="${gold2}" opacity="0.4"/>
        </svg>`;
      case 'parchment':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <filter id="parchment">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise"/>
              <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
              <feBlend in="SourceGraphic" in2="grayNoise" mode="multiply"/>
            </filter>
          </defs>
          <rect x="${m + 4}" y="${m + 4}" width="${w - 2 * m - 8}" height="${h - 2 * m - 8}" fill="#fef9ef" stroke="${color}" stroke-width="2" rx="8" filter="url(#parchment)" opacity="0.97"/>
          <rect x="${m + 10}" y="${m + 10}" width="${w - 2 * m - 20}" height="${h - 2 * m - 20}" fill="none" stroke="${color}" stroke-width="1" rx="4"/>
          <rect x="${m + 16}" y="${m + 16}" width="${w - 2 * m - 32}" height="${h - 2 * m - 32}" fill="none" stroke="${color}" stroke-width="0.5" rx="2" stroke-dasharray="6,3"/>
        </svg>`;
      case 'gothic':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <pattern id="crossPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M20,5 L20,15 M15,10 L25,10" stroke="${color}" stroke-width="0.5" fill="none" opacity="0.08"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="${w}" height="${h}" fill="url(#crossPattern)"/>
          <path d="M${m},${m} L${m + 30},${m} L${m + 30},${m + 30} L${m},${m + 30} Z" fill="none" stroke="${color}" stroke-width="2"/>
          <path d="M${w - m},${m} L${w - m - 30},${m} L${w - m - 30},${m + 30} L${w - m},${m + 30} Z" fill="none" stroke="${color}" stroke-width="2"/>
          <path d="M${m},${h - m} L${m + 30},${h - m} L${m + 30},${h - m - 30} L${m},${h - m - 30} Z" fill="none" stroke="${color}" stroke-width="2"/>
          <path d="M${w - m},${h - m} L${w - m - 30},${h - m} L${w - m - 30},${h - m - 30} L${w - m},${h - m - 30} Z" fill="none" stroke="${color}" stroke-width="2"/>
          <rect x="${m + 35}" y="${m}" width="${w - 2 * m - 70}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="1.5"/>
          <rect x="${m + 40}" y="${m + 5}" width="${w - 2 * m - 80}" height="${h - 2 * m - 10}" fill="none" stroke="${color}" stroke-width="0.5"/>
        </svg>`;
      case 'victorian':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="3" rx="12"/>
          <rect x="${m + 7}" y="${m + 7}" width="${w - 2 * m - 14}" height="${h - 2 * m - 14}" fill="none" stroke="${color}" stroke-width="1.5" rx="8"/>
          <rect x="${m + 12}" y="${m + 12}" width="${w - 2 * m - 24}" height="${h - 2 * m - 24}" fill="none" stroke="${color}" stroke-width="0.5" rx="6"/>
          <rect x="${m + 16}" y="${m + 16}" width="${w - 2 * m - 32}" height="${h - 2 * m - 32}" fill="none" stroke="${color}" stroke-width="0.3" rx="4" stroke-dasharray="3,5"/>
          <circle cx="${m + 30}" cy="${m + 30}" r="8" fill="none" stroke="${color}" stroke-width="0.8"/>
          <circle cx="${m + 30}" cy="${m + 30}" r="5" fill="${color}" opacity="0.1"/>
          <circle cx="${w - m - 30}" cy="${m + 30}" r="8" fill="none" stroke="${color}" stroke-width="0.8"/>
          <circle cx="${w - m - 30}" cy="${m + 30}" r="5" fill="${color}" opacity="0.1"/>
          <circle cx="${m + 30}" cy="${h - m - 30}" r="8" fill="none" stroke="${color}" stroke-width="0.8"/>
          <circle cx="${m + 30}" cy="${h - m - 30}" r="5" fill="${color}" opacity="0.1"/>
          <circle cx="${w - m - 30}" cy="${h - m - 30}" r="8" fill="none" stroke="${color}" stroke-width="0.8"/>
          <circle cx="${w - m - 30}" cy="${h - m - 30}" r="5" fill="${color}" opacity="0.1"/>
        </svg>`;
      case 'academic':
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="acadGrad" x1="0" y1="0" x2="0" y2="${h}">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.03"/>
              <stop offset="100%" stop-color="${color}" stop-opacity="0.08"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${w}" height="${h}" fill="url(#acadGrad)"/>
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="2"/>
          <line x1="${m + 60}" y1="${m + 25}" x2="${w - m - 60}" y2="${m + 25}" stroke="${color}" stroke-width="0.5" opacity="0.3"/>
          <line x1="${m + 60}" y1="${h - m - 25}" x2="${w - m - 60}" y2="${h - m - 25}" stroke="${color}" stroke-width="0.5" opacity="0.3"/>
          <circle cx="${w / 2}" cy="${m + 25}" r="4" fill="${color}" opacity="0.2"/>
          <circle cx="${w / 2}" cy="${h - m - 25}" r="4" fill="${color}" opacity="0.2"/>
        </svg>`;
      case 'university':
        const navy = '#0a1628';
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <defs>
            <linearGradient id="uniGrad" x1="0" y1="0" x2="${w}" y2="${h}">
              <stop offset="0%" stop-color="${navy}" stop-opacity="0.05"/>
              <stop offset="100%" stop-color="${navy}" stop-opacity="0.02"/>
            </linearGradient>
            <linearGradient id="uniBorder" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="${navy}"/>
              <stop offset="50%" stop-color="#1a365d"/>
              <stop offset="100%" stop-color="${navy}"/>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${w}" height="${h}" fill="url(#uniGrad)"/>
          <rect x="${m - 2}" y="${m - 2}" width="${w - 2 * m + 4}" height="${h - 2 * m + 4}" fill="none" stroke="url(#uniBorder)" stroke-width="6" rx="0"/>
          <rect x="${m + 4}" y="${m + 4}" width="${w - 2 * m - 8}" height="${h - 2 * m - 8}" fill="none" stroke="${navy}" stroke-width="1.5" rx="0"/>
          <rect x="${m + 10}" y="${m + 10}" width="${w - 2 * m - 20}" height="${h - 2 * m - 20}" fill="none" stroke="${navy}" stroke-width="0.5" rx="0"/>
          <line x1="${m + 50}" y1="${m + 30}" x2="${w - m - 50}" y2="${m + 30}" stroke="${navy}" stroke-width="0.3"/>
          <line x1="${m + 50}" y1="${h - m - 30}" x2="${w - m - 50}" y2="${h - m - 30}" stroke="${navy}" stroke-width="0.3"/>
          <circle cx="${w / 2}" cy="${m + 30}" r="3" fill="${navy}" opacity="0.3"/>
          <circle cx="${w / 2}" cy="${h - m - 30}" r="3" fill="${navy}" opacity="0.3"/>
        </svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
          <rect x="${m}" y="${m}" width="${w - 2 * m}" height="${h - 2 * m}" fill="none" stroke="${color}" stroke-width="2"/>
        </svg>`;
    }
  }

  private generateRibbonSvg(color: string): string {
    return `<svg width="80" height="30" viewBox="0 0 80 30">
      <defs>
        <linearGradient id="ribbonGrad" x1="0" y1="0" x2="80" y2="0">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="${color}" stop-opacity="1"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.8"/>
        </linearGradient>
      </defs>
      <path d="M0,15 L10,0 L70,0 L80,15 L70,30 L10,30 Z" fill="url(#ribbonGrad)"/>
      <line x1="10" y1="0" x2="70" y2="0" stroke="white" stroke-width="0.5" opacity="0.4"/>
      <line x1="10" y1="30" x2="70" y2="30" stroke="white" stroke-width="0.5" opacity="0.4"/>
    </svg>`;
  }

  generateBadgeSvg(style: string = 'star', color: string = '#f59e0b'): string {
    const size = 60;
    switch (style) {
      case 'star':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="${size}" y2="${size}">
              <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
              <stop offset="100%" stop-color="${this.darkenColor(color, 30)}" stop-opacity="1"/>
            </linearGradient>
            <filter id="starShadow"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.2"/></filter>
          </defs>
          <polygon points="${size / 2},3 ${size * 0.64},${size * 0.33} ${size},${size * 0.36} ${size * 0.72},${size * 0.58} ${size * 0.78},${size} ${size / 2},${size * 0.76} ${size * 0.22},${size} ${size * 0.28},${size * 0.58} 0,${size * 0.36} ${size * 0.36},${size * 0.33}" fill="url(#starGrad)" filter="url(#starShadow)"/>
          <polygon points="${size / 2},8 ${size * 0.56},${size * 0.34} ${size * 0.78},${size * 0.37} ${size * 0.62},${size * 0.54} ${size * 0.66},${size * 0.82} ${size / 2},${size * 0.66} ${size * 0.34},${size * 0.82} ${size * 0.38},${size * 0.54} ${size * 0.22},${size * 0.37} ${size * 0.44},${size * 0.34}" fill="white" opacity="0.25"/>
        </svg>`;
      case 'shield':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="${size}">
              <stop offset="0%" stop-color="${this.lightenColor(color, 20)}"/>
              <stop offset="100%" stop-color="${color}"/>
            </linearGradient>
          </defs>
          <path d="M${size / 2},2 L2,${size * 0.2} L2,${size * 0.5} Q2,${size * 0.75} ${size / 2},${size} Q${size - 2},${size * 0.75} ${size - 2},${size * 0.5} L${size - 2},${size * 0.2} Z" fill="url(#shieldGrad)"/>
          <path d="M${size * 0.15},${size * 0.22} L${size / 2},${size * 0.06} L${size * 0.85},${size * 0.22}" fill="none" stroke="white" stroke-width="1" opacity="0.4"/>
          <text x="${size / 2}" y="${size * 0.45}" text-anchor="middle" fill="white" font-size="${size * 0.35}" font-weight="bold">★</text>
        </svg>`;
      case 'circle':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <radialGradient id="circleBadgeGrad" cx="30%" cy="30%">
              <stop offset="0%" stop-color="${this.lightenColor(color, 30)}"/>
              <stop offset="100%" stop-color="${color}"/>
            </radialGradient>
          </defs>
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="url(#circleBadgeGrad)"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 5}" fill="none" stroke="white" stroke-width="1" opacity="0.3"/>
          <text x="${size / 2}" y="${size * 0.58}" text-anchor="middle" fill="white" font-size="${size * 0.45}" font-weight="bold">★</text>
        </svg>`;
      case 'trophy':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="trophyGrad" x1="0" y1="0" x2="0" y2="${size}">
              <stop offset="0%" stop-color="${this.lightenColor(color, 25)}"/>
              <stop offset="100%" stop-color="${color}"/>
            </linearGradient>
          </defs>
          <path d="M${size * 0.25},2 L${size * 0.25},${size * 0.4} Q${size * 0.15},${size * 0.45} ${size * 0.1},${size * 0.55} L${size * 0.1},${size * 0.65} L${size * 0.3},${size * 0.65} Q${size * 0.35},${size * 0.75} ${size * 0.45},${size * 0.85} L${size * 0.45},${size - 2} L${size * 0.25},${size - 2} L${size * 0.25},${size} L${size * 0.75},${size} L${size * 0.75},${size - 2} L${size * 0.55},${size - 2} L${size * 0.55},${size * 0.85} Q${size * 0.65},${size * 0.75} ${size * 0.7},${size * 0.65} L${size * 0.9},${size * 0.65} L${size * 0.9},${size * 0.55} Q${size * 0.85},${size * 0.45} ${size * 0.75},${size * 0.4} L${size * 0.75},2 Z" fill="url(#trophyGrad)" opacity="0.95"/>
          <rect x="${size * 0.35}" y="2" width="${size * 0.3}" height="${size * 0.35}" fill="white" opacity="0.25" rx="2"/>
          <ellipse cx="${size / 2}" cy="${size * 0.08}" rx="${size * 0.15}" ry="${size * 0.04}" fill="white" opacity="0.15"/>
        </svg>`;
      case 'laurel':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="laurelGrad" x1="0" y1="0" x2="${size}" y2="${size}">
              <stop offset="0%" stop-color="${this.lightenColor(color, 20)}"/>
              <stop offset="100%" stop-color="${color}"/>
            </linearGradient>
          </defs>
          <path d="M${size / 2},${size * 0.05} Q${size * 0.15},${size * 0.2} ${size * 0.1},${size * 0.5} Q${size * 0.05},${size * 0.7} ${size * 0.15},${size * 0.95} L${size * 0.25},${size * 0.9} Q${size * 0.18},${size * 0.7} ${size * 0.22},${size * 0.5} Q${size * 0.25},${size * 0.25} ${size / 2},${size * 0.15} Z" fill="url(#laurelGrad)"/>
          <path d="M${size / 2},${size * 0.05} Q${size * 0.85},${size * 0.2} ${size * 0.9},${size * 0.5} Q${size * 0.95},${size * 0.7} ${size * 0.85},${size * 0.95} L${size * 0.75},${size * 0.9} Q${size * 0.82},${size * 0.7} ${size * 0.78},${size * 0.5} Q${size * 0.75},${size * 0.25} ${size / 2},${size * 0.15} Z" fill="url(#laurelGrad)"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.12}" fill="${this.lightenColor(color, 30)}"/>
          <text x="${size / 2}" y="${size * 0.54}" text-anchor="middle" fill="white" font-size="${size * 0.14}" font-weight="bold">★</text>
        </svg>`;
      case 'graduation_cap':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="${size}">
              <stop offset="0%" stop-color="${this.lightenColor(color, 20)}"/>
              <stop offset="100%" stop-color="${color}"/>
            </linearGradient>
          </defs>
          <polygon points="${size / 2},2 ${size - 2},${size * 0.3} ${size / 2},${size * 0.58} 2,${size * 0.3}" fill="url(#capGrad)"/>
          <rect x="${size * 0.35}" y="${size * 0.3}" width="${size * 0.3}" height="${size * 0.45}" fill="${color}" rx="2"/>
          <line x1="${size / 2}" y1="${size * 0.15}" x2="${size / 2}" y2="${size * 0.75}" stroke="white" stroke-width="0.5" opacity="0.3"/>
        </svg>`;
      case 'medal':
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <defs>
            <linearGradient id="medalGrad" x1="0" y1="0" x2="${size}" y2="${size}">
              <stop offset="0%" stop-color="${this.lightenColor(color, 20)}"/>
              <stop offset="100%" stop-color="${color}"/>
            </linearGradient>
          </defs>
          <circle cx="${size / 2}" cy="${size * 0.4}" r="${size * 0.25}" fill="url(#medalGrad)"/>
          <circle cx="${size / 2}" cy="${size * 0.4}" r="${size * 0.18}" fill="none" stroke="white" stroke-width="1" opacity="0.4"/>
          <text x="${size / 2}" y="${size * 0.44}" text-anchor="middle" fill="white" font-size="${size * 0.2}" font-weight="bold">★</text>
          <path d="M${size * 0.35},${size * 0.55} L${size * 0.35},${size - 2} L${size / 2},${size * 0.82} L${size * 0.65},${size - 2} L${size * 0.65},${size * 0.55}" fill="${color}" opacity="0.7"/>
        </svg>`;
      default:
        return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 5}" fill="none" stroke="white" stroke-width="0.5" opacity="0.3"/>
        </svg>`;
    }
  }

  generateSealSvg(color: string = '#1a365d', text: string = 'VERIFIED'): string {
    const s = 120;
    const cx = s / 2;
    const cy = s / 2;
    const r = s / 2 - 3;
    const innerR = r - 18;
    const outerTextR = r - 7;
    const isGold = color === '#b8860b' || color === '#ffd700' || color === '#c0a030';

    const goldDefs = isGold ? `
    <linearGradient id="sealGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#996515"/>
      <stop offset="30%" stop-color="#ffd700"/>
      <stop offset="50%" stop-color="#fff8dc"/>
      <stop offset="70%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#996515"/>
    </linearGradient>
    <linearGradient id="sealGoldInner" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#b8860b"/>
      <stop offset="50%" stop-color="#ffd700"/>
      <stop offset="100%" stop-color="#b8860b"/>
    </linearGradient>` : '';

    const strokeColor = isGold ? 'url(#sealGold)' : color;
    const fillColor = isGold ? 'url(#sealGoldInner)' : color;
    const sealTextSize = Math.max(6, Math.min(9, Math.floor(80 / Math.max(text.length, 1))));
    const sealTextSpacing = text.length > 8 ? 0.5 : 2;

    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${goldDefs}
     <path id="sealTopArc" d="M ${cx - outerTextR + 4},${cy} A ${outerTextR - 4},${outerTextR - 4} 0 0,1 ${cx + outerTextR - 4},${cy}" fill="none"/>
    <path id="sealBottomArc" d="M ${cx - innerR + 8},${cy} A ${innerR - 8},${innerR - 8} 0 0,0 ${cx + innerR - 8},${cy}" fill="none"/>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-dasharray="4,3"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${strokeColor}" stroke-width="2"/>
   <text font-size="${sealTextSize}" font-family="Georgia, 'Times New Roman', serif" fill="${isGold ? '#ffd700' : color}" font-weight="900" text-anchor="middle" letter-spacing="${sealTextSpacing}">
    <textPath href="#sealTopArc" startOffset="50%">${text}</textPath>
  </text>
  <text font-size="${Math.max(7, Math.floor(innerR / 7))}" font-family="Georgia, serif" fill="${isGold ? '#b8860b' : this.darkenColor(color, 20)}" text-anchor="middle" letter-spacing="1">
    <textPath href="#sealBottomArc" startOffset="50%">AUTHENTICATED</textPath>
  </text>
  <polygon points="${cx - 14},${cy + 2} ${cx},${cy - 14} ${cx + 14},${cy + 2} ${cx + 8},${cy + 2} ${cx + 8},${cy + 12} ${cx - 8},${cy + 12} ${cx - 8},${cy + 2}" fill="${fillColor}" opacity="0.9"/>
  <circle cx="${cx}" cy="${cy - 6}" r="3" fill="${isGold ? '#fff8dc' : 'white'}" opacity="0.6"/>
  <text x="${cx}" y="${cy + 26}" font-size="${Math.max(7, Math.floor(innerR / 8))}" font-family="Arial, sans-serif" fill="${isGold ? '#b8860b' : this.darkenColor(color, 30)}" text-anchor="middle">★</text>
  ${this.generateDotRing(cx, cy, innerR - 4, 18)}
</svg>`;
  }

  private generateDotRing(cx: number, cy: number, r: number, count: number): string {
    let dots = '';
    for (let i = 0; i < count; i++) {
      const angle = (i * 360) / count;
      const rad = (angle * Math.PI) / 180;
      const dx = cx + r * Math.cos(rad);
      const dy = cy + r * Math.sin(rad);
      dots += `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="1.8" fill="${this.darkenColor('#1a365d', 10)}" opacity="0.5"/>`;
    }
    return dots;
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
    const B = Math.max(0, (num & 0x0000ff) - amt);
    return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
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
      certificateComment?: string;
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
    const certificateComment = this.escapeHtml(data.certificateComment || '');

    const borderSvg = this.generateBorderSvg(760, isLandscape ? 520 : 760, data.borderStyle, data.borderColor);
    const badgeSvg = data.showBadge ? this.generateBadgeSvg(data.badgeStyle, data.borderColor) : '';
    const sealSvg = this.generateSealSvg('#0f766e', 'SMART TECH');
    const ribbonSvg = this.generateRibbonSvg(data.borderColor);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Certificate - ${data.studentName}</title>
  <style>
    @page { size: ${data.pageSize || 'A4'} ${isLandscape ? 'landscape' : 'portrait'}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Palatino Linotype', 'Times New Roman', serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
    }
    .cert-page {
      width: 100%; min-height: ${pageH};
      position: relative; display: flex; align-items: center; justify-content: center;
      background: #fefcf9; overflow: hidden;
    }
    .cert-inner {
      position: relative;
       width: 84%; max-width: 660px;
       min-height: ${isLandscape ? '460px' : '660px'};
       display: flex; flex-direction: column; align-items: center;
       justify-content: center; padding: 44px 58px 88px; z-index: 1;
    }
    .border-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
    .border-layer svg { width: 100%; height: 100%; }
     .seal-area { position: absolute; bottom: 22px; right: 22px; opacity: 1; z-index: 0; pointer-events: none; }
     .seal-area svg { width: 128px; height: 128px; }
    .ribbon-area { margin: 6px 0; z-index: 1; }
    .watermark-text {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 100px; color: ${data.borderColor}; opacity: 0.035;
      pointer-events: none; white-space: nowrap; font-weight: bold;
      font-family: Georgia, serif; z-index: 0;
      letter-spacing: 8px;
    }
    .logo-area { margin-bottom: 6px; z-index: 1; }
    .logo-area img { height: 65px; width: auto; object-fit: contain; }
    .school-name {
       font-size: 30px; font-weight: 800;
      color: ${data.borderColor}; margin-bottom: 2px;
      z-index: 1; text-align: center;
      letter-spacing: 1px;
    }
    .school-subtitle {
      font-size: 9px; color: #999; text-transform: uppercase;
      letter-spacing: 3px; margin-bottom: 10px; z-index: 1;
    }
    .cert-title {
       font-size: 13px; color: #374151; font-weight: 700;
      text-transform: uppercase; letter-spacing: 5px;
      margin-bottom: 6px; z-index: 1;
    }
    .divider {
      width: 160px; height: 1px;
      background: linear-gradient(90deg, transparent, ${data.borderColor}, transparent);
      margin: 10px auto; opacity: 0.6; z-index: 1;
    }
    .award-text {
       font-size: 17px; color: #111827; font-weight: 600; margin: 7px 0;
      z-index: 1; text-align: center; font-style: italic;
    }
    .student-name {
       font-size: 42px; font-weight: 800;
      color: ${data.borderColor}; margin: 8px 0;
      font-family: 'Georgia', 'Palatino Linotype', serif;
      z-index: 1; text-align: center;
      letter-spacing: 1px;
    }
     .detail-text { font-size: 14px; color: #1f2937; font-weight: 600; margin: 4px 0; z-index: 1; text-align: center; line-height: 1.6; }
     .comment-box { max-width: 620px; margin: 10px auto 4px; padding: 10px 18px; border-left: 4px solid #0f766e; border-right: 4px solid #0f766e; background: #f0fdfa; color: #134e4a; font-size: 13px; font-weight: 600; line-height: 1.5; z-index: 1; text-align: center; }
    .badge-area { margin: 10px 0; z-index: 1; }
    .badge-area svg { width: 55px; height: 55px; }
    .photo-area { margin: 6px 0; z-index: 1; }
    .photo-area img {
      width: 72px; height: 72px; border-radius: 50%;
      object-fit: cover; border: 2px solid ${data.borderColor};
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .qr-area { margin: 6px 0; z-index: 1; }
    .qr-area svg { width: 55px; height: 55px; }
    .signatures {
      display: flex; justify-content: space-around;
      width: 80%; margin-top: 24px; z-index: 1;
    }
    .sig-box { text-align: center; width: 200px; }
    .sig-line {
      border-top: 2px solid ${data.borderColor};
      width: 85%; margin: 0 auto 6px; padding-top: 8px;
    }
     .sig-label { font-size: 10px; color: #1f2937; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
     .sig-name { font-size: 12px; color: #111827; font-weight: 800; }
    .sig-title { font-size: 8px; color: #aaa; font-style: italic; }
    .cert-number {
       font-size: 16px; color: #0f766e; font-weight: 900; margin-top: 16px;
      z-index: 1; font-family: 'Courier New', monospace;
      letter-spacing: 1px;
    }
    .verification-row {
      display: flex; align-items: center; gap: 12px;
      margin-top: 10px; z-index: 1;
    }
    @media print {
      .cert-page { margin: 0; padding: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
     @media screen and (max-width: 600px) {
       .cert-inner { padding: 28px 24px 80px; width: 92%; }
      .student-name { font-size: 26px; }
      .signatures { flex-direction: column; align-items: center; gap: 16px; }
    }
  </style>
</head>
<body>
  <div class="cert-page">
    <div class="border-layer">${borderSvg}</div>
    <div class="seal-area">${sealSvg}</div>
    ${stampOverlay ? `<div class="stamp-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:2;pointer-events:none;">${stampOverlay}</div>` : ''}
    ${data.showWatermark ? `<div class="watermark-text">${data.watermarkText || 'CERTIFICATE'}</div>` : ''}
    <div class="cert-inner">
      ${data.schoolLogo ? `<div class="logo-area"><img src="${data.schoolLogo}" alt="School Logo"/></div>` : ''}
      <div class="ribbon-area">${ribbonSvg}</div>
      <div class="school-name">${data.schoolName}</div>
      <div class="school-subtitle">Official Academic Document</div>
      <div class="divider"></div>
      <div class="cert-title">Certificate of Achievement</div>
      <div class="award-text"><em>${data.awardText || 'This certificate is proudly awarded to'}</em></div>
      <div class="student-name">${data.studentName}</div>
      ${data.studentPhoto ? `<div class="photo-area"><img src="${data.studentPhoto}" alt="Student"/></div>` : ''}
       <div class="detail-text">In recognition of outstanding academic performance and demonstrated excellence</div>
       <div class="detail-text">${data.className ? `Class: ${data.className}` : ''}${data.className && data.termName ? ' &middot; ' : ''}${data.termName} ${data.academicYear}</div>
       ${certificateComment ? `<div class="comment-box">${certificateComment}</div>` : ''}
      ${badgeSvg ? `<div class="badge-area">${badgeSvg}</div>` : ''}
      <div class="signatures">
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${data.signature1Name || ''}</div>
          <div class="sig-label">${data.signature1Label || 'Head Teacher'}</div>
          ${data.signature1Name ? '<div class="sig-title">Signature</div>' : ''}
        </div>
        <div class="sig-box">
          <div class="sig-line"></div>
          <div class="sig-name">${data.signature2Name || ''}</div>
          <div class="sig-label">${data.signature2Label || 'Director'}</div>
          ${data.signature2Name ? '<div class="sig-title">Signature</div>' : ''}
        </div>
      </div>
      <div class="verification-row">
        ${qrSvg ? `<div class="qr-area">${qrSvg}</div>` : ''}
        <div class="cert-number">Certificate No: ${data.certificateNumber}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] || character);
  }
}
