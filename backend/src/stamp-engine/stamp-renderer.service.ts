import { Injectable, Logger } from '@nestjs/common';
import {
  StampTemplateConfig,
  StampRenderContext,
  StampLayer,
} from './stamp-engine.types';

const DEFAULTS = {
  canvasWidth: 600,
  canvasHeight: 600,
};

function escXml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Point on a circle where 0° = 12 o'clock, positive = clockwise.
 */
function polarPoint(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = deg2rad(deg);
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

/**
 * Layer-based server-side stamp renderer producing resolution-independent SVG.
 *
 * Every layer honors x / y / rotation / opacity / visible / locked / zIndex.
 * Locked layers are rendered but cannot be modified in the designer API;
 * invisible layers are skipped. The output is pure SVG so it renders crisply
 * in both the browser preview and the Puppeteer PDF pipeline.
 */
@Injectable()
export class StampRendererService {
  private readonly logger = new Logger(StampRendererService.name);

  render(config: StampTemplateConfig, ctx: StampRenderContext = { assets: {} }): string {
    const width = Math.max(60, config?.canvas?.width || DEFAULTS.canvasWidth);
    const height = Math.max(60, config?.canvas?.height || DEFAULTS.canvasHeight);
    const background = config?.canvas?.background && config.canvas.background !== 'transparent'
      ? config.canvas.background
      : 'none';

    const parts: string[] = [];
    const defs: string[] = [];

    // ── Effects: ink texture + noise (Puppeteer-safe primitives only) ──
    const effects = config?.effects || {};
    const bodyGroupId = `stampBody_${Math.random().toString(36).slice(2, 9)}`;
    let textureFilter = '';
    if (effects.texture === 'ink' || effects.texture === 'grain') {
      const freq = effects.texture === 'grain' ? 0.9 : 0.35;
      const octaves = effects.texture === 'grain' ? 4 : 2;
      const amount = Math.min(0.6, Math.max(0, effects.noiseAmount ?? 0.18));
      defs.push(
        `<filter id="${bodyGroupId}_noise" x="-10%" y="-10%" width="120%" height="120%">` +
          `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" result="noise" seed="7"/>` +
          `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${amount.toFixed(2)}" result="alphaNoise"/>` +
          `<feComposite operator="out" in="SourceGraphic" in2="alphaNoise" result="textured"/>` +
          `<feBlend in="SourceGraphic" in2="textured" mode="multiply"/>` +
          `</filter>`,
      );
      textureFilter = `filter="url(#${bodyGroupId}_noise)"`;
    }

    parts.push(`<g id="${bodyGroupId}" opacity="${(effects.inkOpacity ?? 1).toFixed(2)}">`);

    // ── Shape: borders + rings ──
    parts.push(this.renderShape(config, width, height));

    // ── Watermark (behind content layers) ──
    if (effects.watermarkText) {
      const wmOpacity = effects.watermarkOpacity ?? 0.08;
      parts.push(
        `<text x="${width / 2}" y="${height / 2}" font-size="${Math.floor(width / 8)}" ` +
          `font-family="serif" fill="#1f2937" fill-opacity="${wmOpacity}" text-anchor="middle" ` +
          `dominant-baseline="middle" transform="rotate(-24 ${width / 2} ${height / 2})">${escXml(effects.watermarkText)}</text>`,
      );
    }

    // ── Layers ordered by zIndex (stable for equal z) ──
    const layers = [...(config.layers || [])]
      .map((l, idx) => ({ l, idx }))
      .sort((a, b) => (a.l.zIndex ?? a.idx) - (b.l.zIndex ?? b.idx));

    for (const { l } of layers) {
      if (l.visible === false) continue;
      const svg = this.renderLayer(l, ctx, config, width, height);
      if (svg) parts.push(svg);
    }

    parts.push('</g>');

    return (
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">` +
      (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
      (background !== 'none' ? `<rect width="${width}" height="${height}" fill="${escXml(background)}"/>` : '') +
      parts.join('') +
      `</svg>`
    );
  }

  // ──────────────────────────────────────────────
  // Shape
  // ──────────────────────────────────────────────

  private renderShape(config: StampTemplateConfig, w: number, h: number): string {
    const shape = config.shape || { type: 'circle', outerRadius: Math.min(w, h) / 2 - 20 };
    const borderWidth = shape.borderWidth ?? 6;
    const borderColor = shape.borderColor || '#1e3a5f';
    const borderCount = Math.max(1, shape.borderCount ?? 1);
    const out: string[] = [];

    switch ((shape.type || 'circle').toLowerCase()) {
      case 'rectangle':
      case 'square': {
        const rw = shape.width ?? w - 40;
        const rh = shape.height ?? h - 40;
        const x0 = (w - rw) / 2;
        const y0 = (h - rh) / 2;
        for (let i = 0; i < borderCount; i++) {
          const inset = i * (borderWidth * 2.2);
          out.push(
            `<rect x="${x0 + inset}" y="${y0 + inset}" width="${rw - inset * 2}" height="${rh - inset * 2}" rx="10" ` +
              `fill="none" stroke="${borderColor}" stroke-width="${borderWidth - i * (borderWidth > 3 ? 1 : 0)}"/>`,
          );
        }
        break;
      }
      case 'oval': {
        const rx = (shape.width ?? w - 40) / 2;
        const ry = (shape.height ?? h - 40) / 2;
        const cx = w / 2;
        const cy = h / 2;
        for (let i = 0; i < borderCount; i++) {
          out.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="${rx - i * borderWidth * 1.6}" ry="${ry - i * borderWidth * 1.6}" ` +
              `fill="none" stroke="${borderColor}" stroke-width="${borderWidth - i * (borderWidth > 3 ? 1 : 0)}"/>`,
          );
        }
        break;
      }
      case 'circle':
      default: {
        const R = Math.min(shape.outerRadius ?? Math.min(w, h) / 2 - 20, Math.min(w, h) / 2);
        const cx = w / 2;
        const cy = h / 2;
        for (let i = 0; i < borderCount; i++) {
          out.push(
            `<circle cx="${cx}" cy="${cy}" r="${R - i * borderWidth * 1.6}" fill="none" ` +
              `stroke="${borderColor}" stroke-width="${borderWidth - i * (borderWidth > 3 ? 1 : 0)}"/>`,
          );
        }
        break;
      }
    }

    // Inner decorative rings
    for (const ring of shape.innerRings || []) {
      out.push(this.renderRing(ring, shape.type || 'circle', w, h));
    }

    return out.join('');
  }

  private renderRing(
    ring: { radius?: number; inset?: number; width: number; color: string; dashed?: boolean; dashGap?: [number, number] },
    shapeType: string,
    w: number,
    h: number,
  ): string {
    const dash = ring.dashed
      ? ` stroke-dasharray="${ring.dashGap?.[0] ?? 4},${ring.dashGap?.[1] ?? 4}"`
      : '';
    if (shapeType === 'rectangle' || shapeType === 'square' || shapeType === 'oval') {
      const inset = ring.inset ?? ring.radius ?? 14;
      const isOval = shapeType === 'oval';
      const rx = ((isOval ? w - 40 : w - 40) / 2) - inset;
      const ry = ((shapeType === 'oval' ? h - 40 : h - 40) / 2) - inset;
      return isOval
        ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${rx}" ry="${ry}" fill="none" stroke="${ring.color}" stroke-width="${ring.width}"${dash}/>`
        : `<rect x="${inset + 4}" y="${inset + 4}" width="${w - (inset + 4) * 2}" height="${h - (inset + 4) * 2}" rx="8" fill="none" stroke="${ring.color}" stroke-width="${ring.width}"${dash}/>`;
    }
    const R = ring.radius ?? Math.min(w, h) / 2 - 34;
    return `<circle cx="${w / 2}" cy="${h / 2}" r="${R}" fill="none" stroke="${ring.color}" stroke-width="${ring.width}"${dash}/>`;
  }

  // ──────────────────────────────────────────────
  // Layers
  // ──────────────────────────────────────────────

  private layerTransform(l: StampLayer, anchorX?: number, anchorY?: number): string {
    const rot = l.rotation ?? 0;
    const ax = anchorX ?? l.x;
    const ay = anchorY ?? l.y;
    const transform = rot ? ` transform="rotate(${rot} ${ax} ${ay})"` : '';
    const opacity = l.opacity != null && l.opacity !== 1 ? ` opacity="${Math.max(0, Math.min(1, l.opacity)).toFixed(2)}"` : '';
    return `${transform}${opacity}`;
  }

  private renderLayer(
    layer: StampLayer,
    ctx: StampRenderContext,
    config: StampTemplateConfig,
    canvasW: number,
    canvasH: number,
  ): string {
    try {
      switch (layer.type) {
        case 'text':
          return this.renderTextLayer(layer, ctx);
        case 'curved-text':
          return this.renderCurvedTextLayer(layer, ctx, config);
        case 'image':
          return this.renderImageLayer(layer, ctx);
        case 'date':
          return this.renderDateLayer(layer, ctx);
        case 'serial':
          return this.renderSerialLayer(layer, ctx);
        case 'verification-marker':
          return this.renderVerificationMarker(layer, ctx, canvasW, canvasH);
        default:
          return '';
      }
    } catch (err) {
      this.logger.warn(`Failed to render layer "${layer.name || layer.id}": ${err?.message}`);
      return '';
    }
  }

  private renderTextLayer(layer: Extract<StampLayer, { type: 'text' }>, _ctx: StampRenderContext): string {
    const fontSize = layer.fontSize ?? 24;
    const fontFamily = layer.fontFamily || 'serif';
    const weight = layer.fontWeight || 'bold';
    const spacing = layer.letterSpacing ?? 0;
    const color = layer.color || '#111827';
    const align = layer.align || 'middle';
    const content = this.resolveDynamicContent(layer.content, _ctx);
    return (
      `<text x="${layer.x}" y="${layer.y}" font-family="${escXml(fontFamily)}" font-size="${fontSize}" ` +
      `font-weight="${weight}" letter-spacing="${spacing}" fill="${color}" text-anchor="${align}"${this.layerTransform(layer)}>` +
      `${escXml(content)}</text>`
    );
  }

  private renderCurvedTextLayer(
    layer: Extract<StampLayer, { type: 'curved-text' }>,
    ctx: StampRenderContext,
    _config: StampTemplateConfig,
  ): string {
    const { centerX, centerY, radius, startAngle, endAngle, orientation } = layer.curve;
    const id = `curve_${Math.abs(hashString(layer.id))}_${Math.floor(layer.x)}_${Math.floor(radius)}`;
    const p1 = polarPoint(centerX, centerY, radius, startAngle);
    const p2 = polarPoint(centerX, centerY, radius, endAngle);

    // outward: clockwise sweep (readable on top arcs); inward: counter-clockwise
    const sweep = orientation === 'outward' ? 1 : 0;
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;

    const fontSize = layer.fontSize ?? 28;
    const spacing = layer.letterSpacing ?? 2;
    const color = layer.color || '#111827';
    const content = this.resolveDynamicContent(layer.content, ctx);

    const parts = [
      `<path id="${id}" d="M ${p1.x.toFixed(2)},${p1.y.toFixed(2)} A ${radius},${radius} 0 ${largeArc} ${sweep} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}" fill="none"/>`,
      `<text font-family="${escXml(layer.fontFamily || 'serif')}" font-size="${fontSize}" font-weight="${layer.fontWeight || 'bold'}" ` +
      `letter-spacing="${spacing}" fill="${color}" text-anchor="middle"${this.layerTransform(layer, centerX, centerY)}>` +
      `<textPath href="#${id}" xlink:href="#${id}" startOffset="50%">${escXml(content)}</textPath></text>`,
    ];

    if (layer.separator) {
      const gapMidAngle = (startAngle + endAngle + 360) / 2;
      const sp = polarPoint(centerX, centerY, radius, gapMidAngle);
      const sepSize = Math.max(10, Math.round(fontSize * 0.6));
      parts.push(
        `<text x="${sp.x.toFixed(2)}" y="${sp.y.toFixed(2)}" font-family="${escXml(layer.fontFamily || 'serif')}" ` +
        `font-size="${sepSize}" font-weight="${layer.fontWeight || 'bold'}" fill="${color}" ` +
        `text-anchor="middle" dominant-baseline="central"${this.layerTransform(layer, centerX, centerY)}>` +
        `${escXml(layer.separator)}</text>`,
      );
    }

    return parts.join('');
  }

  private renderImageLayer(layer: Extract<StampLayer, { type: 'image' }>, ctx: StampRenderContext): string {
    const url = (layer.assetId && ctx.assets[layer.assetId]) || layer.url;
    if (!url) return '';
    return (
      `<image href="${escXml(url)}" xlink:href="${escXml(url)}" x="${layer.x - layer.width / 2}" ` +
      `y="${layer.y - layer.height / 2}" width="${layer.width}" height="${layer.height}" ` +
      `preserveAspectRatio="xMidYMid meet"${this.layerTransform(layer, layer.x, layer.y)} />`
    );
  }

  private renderDateLayer(layer: Extract<StampLayer, { type: 'date' }>, ctx: StampRenderContext): string {
    // Authoritative visual date/time come exclusively from the server context.
    const dateText = ctx.stampDate || '';
    const timeText = ctx.stampTime ? `${ctx.stampTime}${ctx.timezoneLabel ? ' ' + ctx.timezoneLabel : ''}` : '';
    const lines: string[] = [];
    const fontSize = layer.fontSize ?? 16;
    const color = layer.color || '#111827';
    const family = layer.fontFamily || 'serif';

    if (layer.label) lines.push(`<tspan x="${layer.x}" dy="0" font-weight="bold">${escXml(layer.label)}</tspan>`);
    lines.push(
      `<tspan x="${layer.x}" dy="${layer.label ? fontSize * 1.25 : 0}" font-weight="bold">${escXml(dateText)}</tspan>`,
    );
    if (layer.showTime && timeText) {
      lines.push(
        `<tspan x="${layer.x}" dy="${fontSize * 1.25}" font-size="${Math.round(fontSize * 0.72)}" font-weight="normal">${escXml(timeText)}</tspan>`,
      );
    }
    return `<text x="${layer.x}" y="${layer.y}" font-family="${escXml(family)}" font-size="${fontSize}" fill="${color}" text-anchor="middle"${this.layerTransform(layer)}>${lines.join('')}</text>`;
  }

  private renderSerialLayer(layer: Extract<StampLayer, { type: 'serial' }>, ctx: StampRenderContext): string {
    const serial = ctx.serialNumber || '';
    const fontSize = layer.fontSize ?? 13;
    const color = layer.color || '#374151';
    const tspans: string[] = [];
    if (layer.label) tspans.push(`<tspan x="${layer.x}" dy="0">${escXml(layer.label)} </tspan>`);
    tspans.push(`<tspan x="${layer.x}" dy="${layer.label ? fontSize * 1.15 : 0}" font-weight="bold" letter-spacing="1">${escXml(serial)}</tspan>`);
    return (
      `<text x="${layer.x}" y="${layer.y}" font-family="${escXml(layer.fontFamily || 'monospace')}" font-size="${fontSize}" fill="${color}" text-anchor="middle"${this.layerTransform(layer)}>${tspans.join('')}</text>`
    );
  }

  private renderVerificationMarker(
    layer: Extract<StampLayer, { type: 'verification-marker' }>,
    ctx: StampRenderContext,
    canvasW: number,
    canvasH: number,
  ): string {
    const size = layer.size ?? Math.min(canvasW, canvasH) * 0.12;
    const color = layer.color || '#15803d';
    const x = layer.x ?? canvasW / 2;
    const y = layer.y ?? canvasH / 2;
    const check =
      `<path d="M ${x - size * 0.32},${y} L ${x - size * 0.08},${y + size * 0.26} L ${x + size * 0.36},${y - size * 0.22}" ` +
      `fill="none" stroke="${color}" stroke-width="${Math.max(2, size * 0.12)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const circle =
      `<circle cx="${x}" cy="${y}" r="${size / 2}" fill="none" stroke="${color}" stroke-width="${Math.max(1.5, size * 0.07)}"/>`;
    const label = layer.text
      ? `<text x="${x}" y="${y + size * 0.75}" font-family="sans-serif" font-size="${layer.fontSize ?? size * 0.22}" fill="${color}" text-anchor="middle" letter-spacing="1">${escXml(layer.text)}</text>`
      : '';
    return `<g${this.layerTransform({ ...layer, x, y }, x, y)}>${circle}${check}${label}</g>`;
  }

  /** Tokens like {{SERIAL}} inside static text resolve against render context. */
  private resolveDynamicContent(content: string, ctx: StampRenderContext): string {
    if (!content) return '';
    return content
      .replace(/\{\{\s*SERIAL\s*\}\}/gi, ctx.serialNumber || '')
      .replace(/\{\{\s*DATE\s*\}\}/gi, ctx.stampDate || '')
      .replace(/\{\{\s*TIME\s*\}\}/gi, ctx.stampTime || '');
  }
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
