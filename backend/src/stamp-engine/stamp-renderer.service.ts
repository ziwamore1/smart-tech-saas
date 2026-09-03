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
 * Data-driven secondary shape catalog. Each entry returns the vertices of a
 * unit shape centered at (0,0) whose widest extent spans roughly [-1, 1].
 * The renderer multiplies by the layer scale, then translates/rotates. Adding a
 * new institution shape is just a new generator here — no renderer changes.
 */
const SHAPE_CATALOG: Record<string, (innerRatio?: number) => { x: number; y: number }[]> = {
  triangle: () => [[0, -1], [0.9, 0.78], [-0.9, 0.78]].map(p => ({ x: p[0], y: p[1] })),
  pentagon: () => star(5, 0.72),
  hexagon: () => star(6, 1),
  octagon: () => star(8, 1),
  star: (ir = 0.5) => star(5, ir),
  'star-4': (ir = 0.35) => star(4, ir),
  'star-5': (ir = 0.5) => star(5, ir),
  'star-6': (ir = 0.55) => star(6, ir),
  'star-8': (ir = 0.55) => star(8, ir),
  diamond: () => star(4, 1),
  cross: () => {
    const r = 1;
    const a = 0.36;
    const b = 0.14;
    return [
      [-b, -r], [b, -r], [b, -a], [r, -a], [r, a], [b, a], [b, r], [-b, r], [-b, a], [-r, a], [-r, -a], [-b, -a],
    ].map(p => ({ x: p[0], y: p[1] }));
  },
  shield: () => {
    const pts: { x: number; y: number }[] = [];
    pts.push({ x: 0, y: -1 });
    pts.push({ x: 0.95, y: -0.82 });
    pts.push({ x: 0.94, y: 0.05 });
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ang = t * Math.PI; // bottom arc from (0.94,0.05) round to (-0.94,0.05)
      const ax = Math.cos(ang) * 0.94;
      const ay = 0.05 + Math.sin(ang) * 0.95;
      pts.push({ x: ax, y: ay });
    }
    pts.push({ x: -0.95, y: -0.82 });
    return pts;
  },
  heart: () => {
    const pts: { x: number; y: number }[] = [];
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3) / 16;
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16;
      pts.push({ x, y });
    }
    return pts;
  },
  arrow: () => {
    const pts: { x: number; y: number }[] = [];
    const H = 1, W = 0.85, tail = 0.42, tw = 0.34;
    pts.push({ x: -tail, y: -tw });
    pts.push({ x: -tail, y: -H });
    pts.push({ x: W, y: 0 });
    pts.push({ x: -tail, y: H });
    pts.push({ x: -tail, y: tw });
    pts.push({ x: -tail - 0.35, y: tw });
    pts.push({ x: -tail - 0.35, y: -tw });
    return pts;
  },
  parallelogram: () => [[-1, -1], [0.35, -1], [1, 1], [-0.35, 1]].map(p => ({ x: p[0], y: p[1] })),
  trapezoid: () => [[-0.7, -1], [0.7, -1], [1, 1], [-1, 1]].map(p => ({ x: p[0], y: p[1] })),
  flag: () => [[-0.6, -1], [1, -0.35], [-0.6, 0.3]].map(p => ({ x: p[0], y: p[1] })),
};

/** Regular star (or polygon when innerRatio === 1). */
function star(n: number, innerRatio: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const outer = 1;
  const inner = outer * innerRatio;
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = (i * 180) / n; // degrees; start at 12 o'clock going clockwise
    pts.push(polarPoint(0, 0, r, ang));
  }
  return pts;
}

function shapePoints(kind: string, size: number, innerRatio?: number): { x: number; y: number }[] {
  const gen = SHAPE_CATALOG[kind];
  if (!gen) return [];
  return gen(innerRatio).map(p => ({ x: p.x * (size / 2), y: p.y * (size / 2) }));
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
      const amount = Math.min(1.0, Math.max(0, effects.noiseAmount ?? 0.18));
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

    parts.push(`<g id="${bodyGroupId}" opacity="${(effects.inkOpacity ?? 1).toFixed(2)}" ${textureFilter}>`);

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
    ring: { radius?: number; inset?: number; scale?: number; innerWidth?: number; innerHeight?: number; width: number; color: string; dashed?: boolean; dashGap?: [number, number] },
    shapeType: string,
    w: number,
    h: number,
  ): string {
    const dash = ring.dashed
      ? ` stroke-dasharray="${ring.dashGap?.[0] ?? 4},${ring.dashGap?.[1] ?? 4}"`
      : '';
    if (shapeType === 'rectangle' || shapeType === 'square' || shapeType === 'oval') {
      const outerW = w - 40;
      const outerH = h - 40;
      const cx = w / 2;
      const cy = h / 2;
      let innerW: number;
      let innerH: number;
      if (ring.innerWidth && ring.innerHeight) {
        // Explicit independent inner dimensions (non-proportional resizing).
        innerW = Math.max(2, Math.min(outerW, ring.innerWidth));
        innerH = Math.max(2, Math.min(outerH, ring.innerHeight));
      } else {
        // Backward-compatible proportional fallback.
        const scale = Math.max(0.1, Math.min(1, (ring.scale ?? 100) / 100));
        const inset = Math.max(0, ring.inset ?? 14);
        innerW = Math.max(2, (outerW - inset * 2) * scale);
        innerH = Math.max(2, (outerH - inset * 2) * scale);
      }
      const isOval = shapeType === 'oval';
      return isOval
        ? `<ellipse cx="${cx}" cy="${cy}" rx="${innerW / 2}" ry="${innerH / 2}" fill="none" stroke="${ring.color}" stroke-width="${ring.width}"${dash}/>`
        : `<rect x="${cx - innerW / 2}" y="${cy - innerH / 2}" width="${innerW}" height="${innerH}" rx="8" fill="none" stroke="${ring.color}" stroke-width="${ring.width}"${dash}/>`;
    }
    const scale = Math.max(0.1, Math.min(1, (ring.scale ?? 100) / 100));
    const R = Math.max(2, (ring.radius ?? Math.min(w, h) / 2 - 34) * scale);
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
        case 'shape':
          return this.renderShapeLayer(layer, ctx);
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
    const isVertical = layer.direction === 'vertical';

    if (isVertical) {
      const chars = [...content];
      const tspans = chars.map((ch, i) =>
        `<tspan x="${layer.x}" dy="${i === 0 ? 0 : fontSize * 1.3}">${escXml(ch)}</tspan>`,
      ).join('');
      return (
        `<text x="${layer.x}" y="${layer.y}" font-family="${escXml(fontFamily)}" font-size="${fontSize}" ` +
        `font-weight="${weight}" letter-spacing="${spacing}" fill="${color}" text-anchor="${align}"${this.layerTransform(layer)}>` +
        `${tspans}</text>`
      );
    }

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

  private renderShapeLayer(
    layer: Extract<StampLayer, { type: 'shape' }>,
    _ctx: StampRenderContext,
  ): string {
    const kind = layer.shape || 'circle';
    const fill = layer.fill || '#1e3a5f';
    const stroke = layer.stroke || 'none';
    const strokeWidth = layer.strokeWidth ?? 0;
    const opacity = layer.opacity != null ? layer.opacity : 1;

    // Non-round shapes with a catalog entry are rendered as polygons.
    const wantOval = kind === 'oval';
    const wantCircle = kind === 'circle';
    const wantSquare = kind === 'square';
    const wantRounded = kind === 'rounded-rect';

    const size = layer.size ?? 120;
    const w = layer.width ?? size;
    const h = layer.height ?? size;

    // Always rotate / translate around the layer anchor (x, y).
    const rot = layer.rotation ?? 0;
    const transform = ` transform="rotate(${rot} ${layer.x} ${layer.y})"`;
    const op = opacity !== 1 ? ` opacity="${Math.max(0, Math.min(1, opacity)).toFixed(2)}"` : '';

    let body: string;
    if (wantCircle) {
      body = `<circle cx="${layer.x}" cy="${layer.y}" r="${size / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (wantOval) {
      body = `<ellipse cx="${layer.x}" cy="${layer.y}" rx="${w / 2}" ry="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (wantSquare) {
      body = `<rect x="${layer.x - w / 2}" y="${layer.y - h / 2}" width="${w}" height="${h}" rx="${layer.rx ?? 0}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (wantRounded) {
      const r = layer.rx ?? Math.min(w, h) * 0.22;
      body = `<rect x="${layer.x - w / 2}" y="${layer.y - h / 2}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    } else if (layer.points) {
      // Advanced/custom explicit points — translated so (0,0) is the anchor.
      const pts = layer.points
        .split(' ')
        .map(s => s.trim()).filter(Boolean)
        .map(p => {
          const [px, py] = p.split(',').map(Number);
          return `${layer.x + (px || 0)},${layer.y + (py || 0)}`;
        })
        .join(' ');
      body = `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    } else {
      const base = shapePoints(kind, size, layer.innerRatio);
      // Non-uniform scaling: map unit points to width/height independently.
      const sx = size > 0 ? w / size : 1;
      const sy = size > 0 ? h / size : 1;
      const pts = base
        .map(p => `${layer.x + p.x * sx},${layer.y + p.y * sy}`)
        .join(' ');
      body = `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
    }

    return `<g${transform}${op}>${body}</g>`;
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
