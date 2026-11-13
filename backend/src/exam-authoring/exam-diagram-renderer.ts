export type DiagramPoint = { x: number; y: number; label?: string; highlight?: boolean };

export type DiagramLine = {
  from?: DiagramPoint;
  to?: DiagramPoint;
  points?: DiagramPoint[];
  label?: string;
  dashed?: boolean;
  color?: string;
};

export type DiagramSegment = {
  points: DiagramPoint[];
  label?: string;
  dashed?: boolean;
  color?: string;
};

export interface VennDiagramSpec {
  type: 'VENN_3_SET';
  labels?: [string, string, string];
  regionValues?: Partial<Record<'onlyA' | 'onlyB' | 'onlyC' | 'onlyAB' | 'onlyAC' | 'onlyBC' | 'abc' | 'outside', string | number>>;
  universalLabel?: string;
  title?: string;
  caption?: string;
}

export interface CartesianDiagramSpec {
  type: 'CARTESIAN_GRAPH' | 'SPEED_TIME_GRAPH' | 'DISTANCE_TIME_GRAPH';
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xLabel?: string;
  yLabel?: string;
  width?: number;
  height?: number;
  grid?: boolean;
  lines?: DiagramLine[];
  segments?: DiagramSegment[];
  shadedRegion?: DiagramPoint[];
  points?: DiagramPoint[];
  title?: string;
  caption?: string;
}

export interface HistogramDiagramSpec {
  type: 'HISTOGRAM';
  classes: Array<{ label: string; frequency: number }>;
  xLabel?: string;
  yLabel?: string;
  width?: number;
  height?: number;
  frequencyPolygon?: boolean;
  title?: string;
  caption?: string;
}

export interface TriangleConstructionSpec {
  type: 'TRIANGLE_CONSTRUCTION';
  sideAB: number;
  sideAC: number;
  angleA: number;
  units?: string;
  sideABLabel?: string;
  sideACLabel?: string;
  sideBCLabel?: string;
  scaleLabel?: string;
  labels?: { A?: string; B?: string; C?: string };
  showCircumcircle?: boolean;
  showHeight?: boolean;
  showConstructionArcs?: boolean;
  title?: string;
  caption?: string;
}

export interface TriangleDiagramSpec {
  type: 'TRIANGLE';
  points?: { A?: [number, number]; B?: [number, number]; C?: [number, number] };
  labels?: { A?: string; B?: string; C?: string };
  height?: boolean;
  title?: string;
  caption?: string;
}

export type DiagramSpec =
  | VennDiagramSpec
  | CartesianDiagramSpec
  | HistogramDiagramSpec
  | TriangleConstructionSpec
  | TriangleDiagramSpec;

const esc = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

const num = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatNumber = (value: number) => {
  if (Math.abs(value) >= 1000) return value.toLocaleString('en-US');
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
};

const niceStep = (range: number, target = 8) => {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, target);
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * power;
};

const tickValues = (min: number, max: number, step: number) => {
  const result: number[] = [];
  const start = Math.ceil(min / step) * step;
  for (let value = start; value <= max + step * 0.001; value += step) {
    result.push(Number(value.toFixed(10)));
    if (result.length > 40) break;
  }
  return result;
};

const text = (
  x: number,
  y: number,
  value: unknown,
  options: { anchor?: 'start' | 'middle' | 'end'; size?: number; weight?: string; fill?: string; halo?: boolean } = {},
) => `<text x="${x}" y="${y}" text-anchor="${options.anchor || 'start'}" font-size="${options.size || 12}"${options.weight ? ` font-weight="${options.weight}"` : ''} fill="${options.fill || '#111827'}"${options.halo === false ? '' : ' stroke="#ffffff" stroke-width="3" paint-order="stroke"'}">${esc(value)}</text>`;

const titleBlock = (title: string | undefined, width: number, y = 20) =>
  title ? text(width / 2, y, title, { anchor: 'middle', size: 15, weight: '700', halo: false }) : '';

export function renderDiagramSvg(spec: DiagramSpec | null | undefined): string {
  if (!spec || typeof spec !== 'object') return '';
  if (spec.type === 'VENN_3_SET') return renderVenn(spec);
  if (spec.type === 'HISTOGRAM') return renderHistogram(spec);
  if (spec.type === 'TRIANGLE_CONSTRUCTION') return renderTriangleConstruction(spec);
  if (spec.type === 'TRIANGLE') return renderTrianglePoints(spec);
  if (spec.type === 'CARTESIAN_GRAPH' || spec.type === 'SPEED_TIME_GRAPH' || spec.type === 'DISTANCE_TIME_GRAPH') return renderCartesian(spec);
  return '';
}

function collectPoints(spec: CartesianDiagramSpec): DiagramPoint[] {
  const points: DiagramPoint[] = [];
  for (const point of spec.points || []) points.push(point);
  for (const line of spec.lines || []) {
    if (line.from && line.to) points.push(line.from, line.to);
    if (line.points) points.push(...line.points);
  }
  for (const segment of spec.segments || []) points.push(...segment.points);
  for (const point of spec.shadedRegion || []) points.push(point);
  return points.filter(point => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
}

function renderCartesian(spec: CartesianDiagramSpec) {
  const width = num(spec.width, 660);
  const height = num(spec.height, 430);
  const collected = collectPoints(spec);
  const xs = collected.map(point => Number(point.x));
  const ys = collected.map(point => Number(point.y));
  const xMin = num(spec.xMin, xs.length ? Math.min(...xs) : 0);
  const xMax = num(spec.xMax, xs.length ? Math.max(...xs) : 10);
  const yMin = num(spec.yMin, ys.length ? Math.min(...ys) : 0);
  const yMax = num(spec.yMax, ys.length ? Math.max(...ys) : 10);
  if (xMax <= xMin || yMax <= yMin) return '';

  const left = 62;
  const right = 30;
  const top = spec.title ? 46 : 30;
  const bottom = 58;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (value: number) => left + ((value - xMin) / (xMax - xMin)) * plotWidth;
  const y = (value: number) => top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const xStep = niceStep(xMax - xMin, 8);
  const yStep = niceStep(yMax - yMin, 8);
  const xTicks = tickValues(xMin, xMax, xStep);
  const yTicks = tickValues(yMin, yMax, yStep);
  const axisY = yMin <= 0 && yMax >= 0 ? 0 : yMin;
  const axisX = xMin <= 0 && xMax >= 0 ? 0 : xMin;
  const axisYpx = y(axisY);
  const axisXpx = x(axisX);

  const grid: string[] = [];
  if (spec.grid !== false) {
    for (const tick of xTicks) {
      grid.push(`<line x1="${x(tick)}" y1="${top}" x2="${x(tick)}" y2="${top + plotHeight}" stroke="#e2e8f0" stroke-width="1"/>`);
    }
    for (const tick of yTicks) {
      grid.push(`<line x1="${left}" y1="${y(tick)}" x2="${left + plotWidth}" y2="${y(tick)}" stroke="#e2e8f0" stroke-width="1"/>`);
    }
  }

  const xLabels = xTicks
    .map(tick => text(x(tick), axisYpx + 16, formatNumber(tick), { anchor: 'middle', size: 10, fill: '#475569', halo: false }))
    .join('');
  const yLabels = yTicks
    .map(tick => text(axisXpx - 8, y(tick) + 4, formatNumber(tick), { anchor: 'end', size: 10, fill: '#475569', halo: false }))
    .join('');

  const shaded = spec.shadedRegion?.length
    ? `<polygon points="${spec.shadedRegion.map(point => `${x(Number(point.x))},${y(Number(point.y))}`).join(' ')}" fill="#c7d2fe" fill-opacity="0.55" stroke="#4f46e5" stroke-width="1.5"/>`
    : '';

  const lines = (spec.lines || [])
    .filter(line => (line?.from && line?.to) || line?.points?.length)
    .map(line => {
      const stroke = line.color || '#111827';
      const dash = line.dashed ? ' stroke-dasharray="7 5"' : '';
      if (line.points?.length) {
        const points = line.points.map(point => `${x(Number(point.x))},${y(Number(point.y))}`).join(' ');
        const last = line.points[line.points.length - 1];
        const label = line.label ? text(x(Number(last.x)) + 8, y(Number(last.y)) - 8, line.label, { size: 11 }) : '';
        return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="2"${dash}/>${label}`;
      }
      if (!line.from || !line.to) return '';
      const label = line.label
        ? text(x((Number(line.from.x) + Number(line.to.x)) / 2) + 14, y((Number(line.from.y) + Number(line.to.y)) / 2) + 22, line.label, { size: 11 })
        : '';
      return `<line x1="${x(Number(line.from.x))}" y1="${y(Number(line.from.y))}" x2="${x(Number(line.to.x))}" y2="${y(Number(line.to.y))}" stroke="${stroke}" stroke-width="2"${dash}/>${label}`;
    })
    .join('');

  const segments = (spec.segments || [])
    .filter(segment => segment?.points?.length)
    .map(segment => {
      const stroke = segment.color || '#111827';
      const dash = segment.dashed ? ' stroke-dasharray="7 5"' : '';
      const points = segment.points.map(point => `${x(Number(point.x))},${y(Number(point.y))}`).join(' ');
      const dots = segment.points
        .map(point => `<circle cx="${x(Number(point.x))}" cy="${y(Number(point.y))}" r="3" fill="${stroke}"/>`)
        .join('');
      const label = segment.label
        ? text(x(Number(segment.points[segment.points.length - 1].x)) + 8, y(Number(segment.points[segment.points.length - 1].y)) + 18, segment.label, { size: 11, weight: '600' })
        : '';
      return `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="2.5"${dash}/>${dots}${label}`;
    })
    .join('');

  const points = (spec.points || [])
    .filter(point => Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)))
    .map(point => {
      const px = x(Number(point.x));
      const py = y(Number(point.y));
      const radius = point.highlight ? 6 : 4;
      const fill = point.highlight ? '#dc2626' : '#111827';
      const label = point.label
        ? text(px + 9, py - 9, point.label, { size: 11, weight: point.highlight ? '700' : '500' })
        : '';
      return `<circle cx="${px}" cy="${py}" r="${radius}" fill="${fill}"/>${label}`;
    })
    .join('');

  const arrowX = `<polygon points="${left + plotWidth},${axisYpx} ${left + plotWidth - 9},${axisYpx - 5} ${left + plotWidth - 9},${axisYpx + 5}" fill="#111827"/>`;
  const arrowY = `<polygon points="${axisXpx},${top} ${axisXpx - 5},${top + 9} ${axisXpx + 5},${top + 9}" fill="#111827"/>`;
  const defaultXLabel = spec.type === 'SPEED_TIME_GRAPH' || spec.type === 'DISTANCE_TIME_GRAPH' ? 'Time (s)' : 'x';
  const defaultYLabel = spec.type === 'SPEED_TIME_GRAPH' ? 'Speed (m/s)' : spec.type === 'DISTANCE_TIME_GRAPH' ? 'Distance (m)' : 'y';
  const axisTitles =
    text(left + plotWidth / 2, height - 14, spec.xLabel || defaultXLabel, { anchor: 'middle', size: 12, weight: '600' }) +
    `<text x="18" y="${top + plotHeight / 2}" text-anchor="middle" font-size="12" font-weight="600" fill="#111827" transform="rotate(-90 18 ${top + plotHeight / 2})">${esc(spec.yLabel || defaultYLabel)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" style="max-width:100%;height:auto"><title>${esc(spec.title || spec.caption || 'Graph')}</title><rect width="${width}" height="${height}" fill="#ffffff"/>${titleBlock(spec.title, width)}${grid.join('')}<line x1="${left}" y1="${axisYpx}" x2="${left + plotWidth}" y2="${axisYpx}" stroke="#111827" stroke-width="1.6"/>${arrowX}<line x1="${axisXpx}" y1="${top + plotHeight}" x2="${axisXpx}" y2="${top}" stroke="#111827" stroke-width="1.6"/>${arrowY}${xLabels}${yLabels}${shaded}${lines}${segments}${points}${axisTitles}</svg>`;
}

function renderHistogram(spec: HistogramDiagramSpec) {
  const classes = (spec.classes || []).filter(item => item && item.label !== undefined);
  if (!classes.length) return '';
  const width = num(spec.width, 660);
  const height = num(spec.height, 430);
  const left = 66;
  const right = 30;
  const top = spec.title ? 46 : 30;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxFrequency = Math.max(1, ...classes.map(item => Math.max(0, num(item.frequency, 0))));
  const step = niceStep(maxFrequency, 6);
  const yMax = Math.max(step, Math.ceil((maxFrequency + step * 0.1) / step) * step);
  const barWidth = plotWidth / classes.length;
  const x = (index: number) => left + index * barWidth;
  const y = (value: number) => top + plotHeight - (value / yMax) * plotHeight;
  const yTicks = tickValues(0, yMax, step);

  const grid = yTicks
    .map(tick => `<line x1="${left}" y1="${y(tick)}" x2="${left + plotWidth}" y2="${y(tick)}" stroke="#e2e8f0" stroke-width="1"/>`)
    .join('');
  const yLabels = yTicks
    .map(tick => text(left - 8, y(tick) + 4, formatNumber(tick), { anchor: 'end', size: 10, fill: '#475569', halo: false }))
    .join('');
  const bars = classes
    .map((item, index) => {
      const frequency = Math.max(0, num(item.frequency, 0));
      const barHeight = y(0) - y(frequency);
      const label = text(x(index) + barWidth / 2, y(frequency) - 5, formatNumber(frequency), { anchor: 'middle', size: 10, fill: '#1e3a8a', halo: false });
      return `<rect x="${x(index)}" y="${y(frequency)}" width="${barWidth}" height="${barHeight}" fill="#93c5fd" stroke="#1d4ed8" stroke-width="1.2"/>${label}`;
    })
    .join('');
  const classLabels = classes
    .map((item, index) => text(x(index) + barWidth / 2, top + plotHeight + 18, item.label, { anchor: 'middle', size: 10, fill: '#334155', halo: false }))
    .join('');
  const polygonPoints = classes.map((item, index) => `${x(index) + barWidth / 2},${y(Math.max(0, num(item.frequency, 0)))}`).join(' ');
  const polygon = spec.frequencyPolygon
    ? `<polyline points="${polygonPoints}" fill="none" stroke="#dc2626" stroke-width="2.2"/>${classes
        .map((item, index) => `<circle cx="${x(index) + barWidth / 2}" cy="${y(Math.max(0, num(item.frequency, 0)))}" r="3" fill="#dc2626"/>`)
        .join('')}`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" style="max-width:100%;height:auto"><title>${esc(spec.title || spec.caption || 'Histogram')}</title><rect width="${width}" height="${height}" fill="#ffffff"/>${titleBlock(spec.title, width)}${grid}<line x1="${left}" y1="${y(0)}" x2="${left + plotWidth}" y2="${y(0)}" stroke="#111827" stroke-width="1.6"/><line x1="${left}" y1="${y(0)}" x2="${left}" y2="${top}" stroke="#111827" stroke-width="1.6"/>${yLabels}${bars}${polygon}${classLabels}${text(left + plotWidth / 2, height - 14, spec.xLabel || 'Class interval', { anchor: 'middle', size: 12, weight: '600' })}<text x="18" y="${top + plotHeight / 2}" text-anchor="middle" font-size="12" font-weight="600" fill="#111827" transform="rotate(-90 18 ${top + plotHeight / 2})">${esc(spec.yLabel || 'Frequency')}</text></svg>`;
}

function renderVenn(spec: VennDiagramSpec) {
  const labels = spec.labels || ['A', 'B', 'C'];
  const values = spec.regionValues || {};
  const width = 480;
  const height = 400;
  const circles = [
    { cx: 170, cy: 160, label: labels[0] },
    { cx: 290, cy: 160, label: labels[1] },
    { cx: 230, cy: 240, label: labels[2] },
  ];
  const positions: Record<string, { x: number; y: number }> = {
    onlyA: { x: 120, y: 150 },
    onlyB: { x: 340, y: 150 },
    onlyC: { x: 230, y: 295 },
    onlyAB: { x: 230, y: 125 },
    onlyAC: { x: 165, y: 215 },
    onlyBC: { x: 295, y: 215 },
    abc: { x: 230, y: 185 },
    outside: { x: 52, y: 62 },
  };
  const regionText = Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(([key, value]) => {
      const position = positions[key];
      if (!position) return '';
      return text(position.x, position.y, value, { anchor: 'middle', size: 13, weight: '600', halo: false });
    })
    .join('');
  const setLabels = circles
    .map((circle, index) => {
      const labelPositions = [
        { x: 112, y: 92 },
        { x: 348, y: 92 },
        { x: 230, y: 352 },
      ][index];
      return text(labelPositions.x, labelPositions.y, circle.label, { anchor: 'middle', size: 15, weight: '700', halo: false });
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" style="max-width:100%;height:auto"><title>${esc(spec.title || spec.caption || 'Venn diagram')}</title><rect width="${width}" height="${height}" fill="#ffffff"/>${titleBlock(spec.title, width)}<rect x="20" y="30" width="440" height="340" fill="#f8fafc" stroke="#334155" stroke-width="1.5"/>${text(30, 52, spec.universalLabel || 'ξ', { size: 16, weight: '700', halo: false })}${circles
    .map(circle => `<circle cx="${circle.cx}" cy="${circle.cy}" r="100" fill="#dbeafe" fill-opacity="0.45" stroke="#1e3a8a" stroke-width="2"/>`)
    .join('')}${setLabels}${regionText}</svg>`;
}

function renderTrianglePoints(spec: TriangleDiagramSpec) {
  const points = spec.points || { A: [80, 280], B: [360, 280], C: [220, 60] };
  const A = points.A || [80, 280];
  const B = points.B || [360, 280];
  const C = points.C || [220, 60];
  const labels = spec.labels || {};
  const heightLine = spec.height
    ? `<line x1="${C[0]}" y1="${C[1]}" x2="${C[0]}" y2="${A[1]}" stroke="#64748b" stroke-dasharray="5 4"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 340" role="img" style="max-width:100%;height:auto"><title>${esc(spec.title || spec.caption || 'Triangle')}</title><rect width="440" height="340" fill="#ffffff"/><polygon points="${A.join(',')} ${B.join(',')} ${C.join(',')}" fill="#eff6ff" stroke="#111827" stroke-width="2"/>${heightLine}${text(A[0] - 16, A[1] + 18, labels.A || 'A', { size: 13, weight: '600' })}${text(B[0] + 8, B[1] + 18, labels.B || 'B', { size: 13, weight: '600' })}${text(C[0], C[1] - 10, labels.C || 'C', { anchor: 'middle', size: 13, weight: '600' })}</svg>`;
}

function renderTriangleConstruction(spec: TriangleConstructionSpec) {
  const ab = num(spec.sideAB, 0);
  const ac = num(spec.sideAC, 0);
  const angle = num(spec.angleA, 0);
  if (ab <= 0 || ac <= 0 || angle <= 0 || angle >= 180) return '';
  const radians = (angle * Math.PI) / 180;
  const scale = 340 / Math.max(ab, ac);
  const A = { x: 90, y: 340 };
  const B = { x: A.x + ab * scale, y: A.y };
  const C = { x: A.x + ac * scale * Math.cos(radians), y: A.y - ac * scale * Math.sin(radians) };
  const bc = Math.sqrt(ab * ab + ac * ac - 2 * ab * ac * Math.cos(radians));
  const labels = spec.labels || {};
  const units = spec.units ? ` ${spec.units}` : '';
  const abLabel = spec.sideABLabel || `${formatNumber(ab)}${units}`;
  const acLabel = spec.sideACLabel || `${formatNumber(ac)}${units}`;
  const bcLabel = spec.sideBCLabel || `${formatNumber(Number(bc.toFixed(1)))}${units}`;

  let circumcenter: { x: number; y: number } | null = null;
  let circumradius = 0;
  if (spec.showCircumcircle) {
    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
    if (Math.abs(d) > 0.0001) {
      const a2 = A.x * A.x + A.y * A.y;
      const b2 = B.x * B.x + B.y * B.y;
      const c2 = C.x * C.x + C.y * C.y;
      circumcenter = {
        x: (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d,
        y: (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d,
      };
      circumradius = Math.hypot(circumcenter.x - A.x, circumcenter.y - A.y);
    }
  }

  const xs = [A.x, B.x, C.x];
  const ys = [A.y, B.y, C.y];
  if (circumcenter) {
    xs.push(circumcenter.x - circumradius, circumcenter.x + circumradius);
    ys.push(circumcenter.y - circumradius, circumcenter.y + circumradius);
  }
  const minX = Math.min(...xs) - 45;
  const maxX = Math.max(...xs) + 45;
  const minY = Math.min(...ys) - (spec.title ? 65 : 45);
  const maxY = Math.max(...ys) + 55;
  const viewWidth = maxX - minX;
  const viewHeight = maxY - minY;

  const angleArcRadius = 40;
  const angleStart = { x: A.x + angleArcRadius, y: A.y };
  const angleEnd = { x: A.x + angleArcRadius * Math.cos(radians), y: A.y - angleArcRadius * Math.sin(radians) };
  const angleLabel = text(
    A.x + (angleArcRadius + 18) * Math.cos(radians / 2),
    A.y - (angleArcRadius + 18) * Math.sin(radians / 2),
    `${formatNumber(angle)}°`,
    { anchor: 'middle', size: 12, weight: '600' },
  );

  const constructionArcs = spec.showConstructionArcs
    ? `<path d="M ${A.x + ac * scale} ${A.y} A ${ac * scale} ${ac * scale} 0 0 0 ${C.x} ${C.y}" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>` +
      `<path d="M ${B.x + bc * scale * Math.cos(Math.atan2(C.y - B.y, C.x - B.x) - 0.35)} ${B.y + bc * scale * Math.sin(Math.atan2(C.y - B.y, C.x - B.x) - 0.35)} A ${bc * scale} ${bc * scale} 0 0 1 ${B.x + bc * scale * Math.cos(Math.atan2(C.y - B.y, C.x - B.x) + 0.35)} ${B.y + bc * scale * Math.sin(Math.atan2(C.y - B.y, C.x - B.x) + 0.35)}" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="4 4"/>`
    : '';

  const heightFoot = { x: C.x, y: A.y };
  const heightLine = spec.showHeight
    ? `<line x1="${C.x}" y1="${C.y}" x2="${heightFoot.x}" y2="${heightFoot.y}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="6 4"/>` +
      `<path d="M ${heightFoot.x} ${heightFoot.y} l 12 0 l 0 -12" fill="none" stroke="#64748b" stroke-width="1.2"/>` +
      text(heightFoot.x + 8, (C.y + heightFoot.y) / 2, 'h', { size: 12, weight: '600' })
    : '';

  const circumcircle = circumcenter
    ? `<circle cx="${circumcenter.x}" cy="${circumcenter.y}" r="${circumradius}" fill="none" stroke="#2563eb" stroke-width="2"/>` +
      `<circle cx="${circumcenter.x}" cy="${circumcenter.y}" r="3" fill="#2563eb"/>` +
      `<line x1="${circumcenter.x}" y1="${circumcenter.y}" x2="${A.x}" y2="${A.y}" stroke="#2563eb" stroke-width="1.4" stroke-dasharray="5 4"/>` +
      text((circumcenter.x + A.x) / 2 + 6, (circumcenter.y + A.y) / 2 - 6, `R ≈ ${formatNumber(Number(circumradius.toFixed(1)))}`, { size: 11, weight: '600', fill: '#1d4ed8' }) +
      text(circumcenter.x + 8, circumcenter.y - 8, 'O', { size: 12, weight: '700', fill: '#1d4ed8' })
    : '';

  const scaleLabel = spec.scaleLabel
    ? text(minX + 18, maxY - 14, spec.scaleLabel, { size: 11, fill: '#475569', halo: false })
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewWidth} ${viewHeight}" role="img" style="max-width:100%;height:auto"><title>${esc(spec.title || spec.caption || 'Triangle construction')}</title><rect x="${minX}" y="${minY}" width="${viewWidth}" height="${viewHeight}" fill="#ffffff"/>${spec.title ? text(minX + viewWidth / 2, minY + 22, spec.title, { anchor: 'middle', size: 15, weight: '700', halo: false }) : ''}<polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}" fill="#eff6ff" stroke="#111827" stroke-width="2.2"/>${constructionArcs}${heightLine}${circumcircle}<path d="M ${angleStart.x} ${angleStart.y} A ${angleArcRadius} ${angleArcRadius} 0 0 0 ${angleEnd.x} ${angleEnd.y}" fill="none" stroke="#dc2626" stroke-width="1.8"/>${angleLabel}${text((A.x + B.x) / 2, A.y + 20, abLabel, { anchor: 'middle', size: 12, weight: '600' })}${text((A.x + C.x) / 2 - 10, (A.y + C.y) / 2 - 4, acLabel, { anchor: 'end', size: 12, weight: '600' })}${text((B.x + C.x) / 2 + 10, (B.y + C.y) / 2 + 6, bcLabel, { size: 12, weight: '600' })}${text(A.x - 14, A.y + 20, labels.A || 'A', { size: 14, weight: '700' })}${text(B.x + 10, B.y + 20, labels.B || 'B', { size: 14, weight: '700' })}${text(C.x, C.y - 12, labels.C || 'C', { anchor: 'middle', size: 14, weight: '700' })}${scaleLabel}</svg>`;
}
