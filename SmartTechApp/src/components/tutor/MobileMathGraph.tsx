import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, G, Rect, Polygon } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme';

interface GraphSpec {
  type: string;
  function: string;
  xLabel?: string;
  yLabel?: string;
  showIntercepts?: boolean;
  showTurningPoint?: boolean;
  showAsymptotes?: boolean;
  domain?: [number, number];
  shadedRegion?: { start: number; end: number; color: string };
}

interface CriticalPoint {
  x: number;
  y: number;
  type: 'root' | 'max' | 'min' | 'inflection';
}

function preprocessExpression(expr: string): string {
  let s = expr;
  s = s.replace(/\^/g, '**');
  s = s.replace(/\bsin\b/g, 'Math.sin');
  s = s.replace(/\bcos\b/g, 'Math.cos');
  s = s.replace(/\btan\b/g, 'Math.tan');
  s = s.replace(/\blog\b/g, 'Math.log');
  s = s.replace(/\bsqrt\b/g, 'Math.sqrt');
  s = s.replace(/\babs\b/g, 'Math.abs');
  s = s.replace(/\bpi\b/g, `(${Math.PI})`);
  s = s.replace(/\be\b(?![\w.])/g, `(${Math.E})`);
  s = s.replace(/(\d)([a-zA-Z\(])/g, '$1*$2');
  s = s.replace(/(\))([a-zA-Z\(])/g, '$1*$2');
  s = s.replace(/(\))(\d)/g, '$1*$2');
  return s;
}

function evaluateFunction(expr: string, x: number): number | null {
  try {
    const sanitized = preprocessExpression(expr);
    const fn = new Function('x', `try { return (${sanitized}); } catch { return null; }`);
    return fn(x);
  } catch {
    return null;
  }
}

function generatePoints(expr: string, domain: [number, number], steps = 250): Array<[number, number]> {
  const [min, max] = domain;
  const step = (max - min) / steps;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const x = min + i * step;
    const y = evaluateFunction(expr, x);
    if (y !== null && isFinite(y) && !isNaN(y)) {
      points.push([x, y]);
    }
  }
  return points;
}

function findRoots(expr: string, domain: [number, number]): CriticalPoint[] {
  const roots: CriticalPoint[] = [];
  const points = generatePoints(expr, domain, 500);
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if ((y1 < 0 && y2 >= 0) || (y1 >= 0 && y2 < 0)) {
      const ratio = Math.abs(y1) / (Math.abs(y1) + Math.abs(y2));
      const x = x1 + (x2 - x1) * ratio;
      const y = evaluateFunction(expr, x) ?? 0;
      const alreadyFound = roots.some(r => Math.abs(r.x - x) < 0.05);
      if (!alreadyFound) {
        roots.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, type: 'root' });
      }
    }
  }
  return roots;
}

function findAllCriticalPoints(expr: string, domain: [number, number]): CriticalPoint[] {
  const points = generatePoints(expr, domain, 500);
  if (points.length < 4) return [];
  const criticalPoints: CriticalPoint[] = [];
  const h = (domain[1] - domain[0]) / 500;
  for (let i = 2; i < points.length - 2; i++) {
    const x = points[i][0];
    const yPrev = evaluateFunction(expr, x - h);
    const yNext = evaluateFunction(expr, x + h);
    if (yPrev === null || yNext === null) continue;
    const deriv = (yNext - yPrev) / (2 * h);
    if (Math.abs(deriv) < 0.01) {
      const yPrev2 = evaluateFunction(expr, x - 2 * h);
      const yCurr = evaluateFunction(expr, x);
      const yNext2 = evaluateFunction(expr, x + 2 * h);
      if (yPrev2 === null || yCurr === null || yNext2 === null) continue;
      const secondDeriv = (yNext2 - 2 * yCurr + yPrev2) / (4 * h * h);
      let type: 'max' | 'min' | 'inflection';
      if (secondDeriv < -0.001) type = 'max';
      else if (secondDeriv > 0.001) type = 'min';
      else type = 'inflection';
      const alreadyFound = criticalPoints.some(cp => Math.abs(cp.x - x) < h * 3);
      if (!alreadyFound) {
        criticalPoints.push({ x: Math.round(x * 100) / 100, y: Math.round(yCurr * 100) / 100, type });
      }
    }
  }
  return criticalPoints;
}

const PADDING = { top: 20, right: 16, bottom: 36, left: 44 };
const GRAPH_BG = '#ffffff';
const AXIS_COLOR = '#374151';
const GRID_COLOR = '#e5e7eb';
const CURVE_COLOR = '#f97316';

function toSvgCoords(
  x: number,
  y: number,
  domain: [number, number],
  yRange: [number, number],
  width: number,
  height: number,
): { sx: number; sy: number } {
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;
  const sx = PADDING.left + ((x - domain[0]) / (domain[1] - domain[0])) * plotW;
  const sy = PADDING.top + ((yRange[1] - y) / (yRange[1] - yRange[0])) * plotH;
  return { sx, sy };
}

export function MobileMathGraph({ spec }: { spec: GraphSpec }) {
  const domain = spec.domain || [-10, 10];
  const [showRoots, setShowRoots] = useState(spec.showIntercepts ?? true);
  const [showStationary, setShowStationary] = useState(spec.showTurningPoint ?? true);

  const screenWidth = Dimensions.get('window').width;
  const graphWidth = Math.min(screenWidth - spacing.md * 2 - 2, 500);
  const graphHeight = 260;

  const { points, roots, criticalPoints, yMin, yMax } = useMemo(() => {
    const pts = generatePoints(spec.function, domain);
    const yVals = pts.map(([, y]) => y).filter(v => isFinite(v));
    let yMinVal = Math.min(...yVals);
    let yMaxVal = Math.max(...yVals);
    const pad = (yMaxVal - yMinVal) * 0.15 || 2;
    yMinVal = yMinVal - pad;
    yMaxVal = yMaxVal + pad;
    if (yMinVal === yMaxVal) { yMinVal -= 1; yMaxVal += 1; }
    const rts = findRoots(spec.function, domain);
    const cps = findAllCriticalPoints(spec.function, domain);
    return { points: pts, roots: rts, criticalPoints: cps, yMin: yMinVal, yMax: yMaxVal };
  }, [spec.function, domain]);

  const visibleCriticalPoints = useMemo(() => {
    const result: CriticalPoint[] = [];
    if (showRoots) result.push(...roots);
    const stationaries = showStationary ? criticalPoints.filter(p => p.type !== 'root') : [];
    result.push(...stationaries);
    return result;
  }, [roots, criticalPoints, showRoots, showStationary]);

  const pathD = useMemo(() => {
    if (points.length < 2) return '';
    const parts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const { sx, sy } = toSvgCoords(points[i][0], points[i][1], domain, [yMin, yMax], graphWidth, graphHeight);
      if (i === 0) parts.push(`M${sx},${sy}`);
      else parts.push(`L${sx},${sy}`);
    }
    return parts.join(' ');
  }, [points, domain, yMin, yMax, graphWidth, graphHeight]);

  const xAxisY = useMemo(() => {
    const { sy } = toSvgCoords(0, 0, domain, [yMin, yMax], graphWidth, graphHeight);
    return Math.max(PADDING.top, Math.min(graphHeight - PADDING.bottom, sy));
  }, [domain, yMin, yMax, graphWidth, graphHeight]);

  const yAxisX = useMemo(() => {
    const { sx } = toSvgCoords(0, 0, domain, [yMin, yMax], graphWidth, graphHeight);
    return Math.max(PADDING.left, Math.min(graphWidth - PADDING.right, sx));
  }, [domain, yMin, yMax, graphWidth, graphHeight]);

  const gridLines = useMemo(() => {
    const lines: { x: number }[] = [];
    const nTicks = 6;
    for (let i = 0; i <= nTicks; i++) {
      const x = domain[0] + ((domain[1] - domain[0]) * i) / nTicks;
      lines.push({ x });
    }
    return lines;
  }, [domain]);

  const hasRoots = roots.length > 0;
  const hasStationary = criticalPoints.some(p => p.type !== 'root');

  const pointColors: Record<string, string> = {
    root: '#10b981',
    max: '#ef4444',
    min: '#3b82f6',
    inflection: '#8b5cf6',
  };
  const pointLabels: Record<string, string> = {
    root: 'Root',
    max: 'Max',
    min: 'Min',
    inflection: 'Inflection',
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.functionLabel} numberOfLines={1}>f(x) = {spec.function}</Text>
        <View style={styles.toggleRow}>
          {hasRoots && (
            <TouchableOpacity
              style={[styles.toggleChip, showRoots ? styles.toggleRootActive : styles.toggleInactive]}
              onPress={() => setShowRoots(v => !v)}
            >
              <Text style={[styles.toggleText, showRoots && { color: '#10b981' }]}>Roots</Text>
            </TouchableOpacity>
          )}
          {hasStationary && (
            <TouchableOpacity
              style={[styles.toggleChip, showStationary ? styles.toggleStationaryActive : styles.toggleInactive]}
              onPress={() => setShowStationary(v => !v)}
            >
              <Text style={[styles.toggleText, showStationary && { color: '#8b5cf6' }]}>Stationary</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
        <Svg width={graphWidth} height={graphHeight}>
          <Rect x={0} y={0} width={graphWidth} height={graphHeight} fill={GRAPH_BG} rx={8} />

          {/* Grid lines (vertical) */}
          {gridLines.map((gl, i) => {
            const { sx } = toSvgCoords(gl.x, 0, domain, [yMin, yMax], graphWidth, graphHeight);
            return (
              <G key={`grid-v-${i}`}>
                <Line x1={sx} y1={PADDING.top} x2={sx} y2={graphHeight - PADDING.bottom} stroke={GRID_COLOR} strokeWidth={0.5} strokeDasharray="4,4" />
                <SvgText x={sx} y={graphHeight - 8} fontSize={9} fill="#9ca3af" textAnchor="middle">
                  {gl.x === 0 ? '0' : gl.x % 1 === 0 ? gl.x.toString() : gl.x.toFixed(1)}
                </SvgText>
              </G>
            );
          })}

          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75].map((frac, i) => {
            const yVal = yMin + (yMax - yMin) * frac;
            const { sy } = toSvgCoords(0, yVal, domain, [yMin, yMax], graphWidth, graphHeight);
            return (
              <G key={`grid-h-${i}`}>
                <Line x1={PADDING.left} y1={sy} x2={graphWidth - PADDING.right} y2={sy} stroke={GRID_COLOR} strokeWidth={0.5} strokeDasharray="4,4" />
                <SvgText x={PADDING.left - 6} y={sy + 3} fontSize={9} fill="#9ca3af" textAnchor="end">
                  {yVal % 1 === 0 ? yVal.toString() : yVal.toFixed(1)}
                </SvgText>
              </G>
            );
          })}

          {/* X axis */}
          <Line
            x1={PADDING.left}
            y1={xAxisY}
            x2={graphWidth - PADDING.right}
            y2={xAxisY}
            stroke={AXIS_COLOR}
            strokeWidth={1.5}
          />

          {/* Y axis */}
          <Line
            x1={yAxisX}
            y1={PADDING.top}
            x2={yAxisX}
            y2={graphHeight - PADDING.bottom}
            stroke={AXIS_COLOR}
            strokeWidth={1.5}
          />

          {/* Axis arrows */}
          <Polygon points={`${graphWidth - PADDING.right - 4},${xAxisY - 4} ${graphWidth - PADDING.right},${xAxisY} ${graphWidth - PADDING.right - 4},${xAxisY + 4}`} fill={AXIS_COLOR} />
          <Polygon points={`${yAxisX - 4},${PADDING.top + 4} ${yAxisX},${PADDING.top} ${yAxisX + 4},${PADDING.top + 4}`} fill={AXIS_COLOR} />

          {/* Axis labels */}
          <SvgText x={graphWidth - PADDING.right + 4} y={xAxisY + 4} fontSize={12} fill={AXIS_COLOR} fontWeight="bold">
            {spec.xLabel || 'x'}
          </SvgText>
          <SvgText x={yAxisX + 4} y={PADDING.top - 4} fontSize={12} fill={AXIS_COLOR} fontWeight="bold">
            {spec.yLabel || 'y'}
          </SvgText>

          {/* Shaded region */}
          {spec.shadedRegion && (() => {
            const { sx: sxs } = toSvgCoords(spec.shadedRegion.start, 0, domain, [yMin, yMax], graphWidth, graphHeight);
            const { sx: sxe } = toSvgCoords(spec.shadedRegion.end, 0, domain, [yMin, yMax], graphWidth, graphHeight);
            const shadedPoints = points
              .filter(([x]) => x >= spec.shadedRegion!.start && x <= spec.shadedRegion!.end)
              .map(([x, y]) => toSvgCoords(x, y, domain, [yMin, yMax], graphWidth, graphHeight));
            if (shadedPoints.length < 2) return null;
            let path = `M${sxs},${xAxisY}`;
            for (const { sx, sy } of shadedPoints) path += ` L${sx},${sy}`;
            path += ` L${sxe},${xAxisY} Z`;
            return <Path d={path} fill={spec.shadedRegion?.color || 'rgba(249, 115, 22, 0.15)'} />;
          })()}

          {/* Curve */}
          <Path d={pathD} stroke={CURVE_COLOR} strokeWidth={2.5} fill="none" strokeLinejoin="round" />

          {/* Critical points */}
          {visibleCriticalPoints.map((cp, i) => {
            const { sx, sy } = toSvgCoords(cp.x, cp.y, domain, [yMin, yMax], graphWidth, graphHeight);
            const color = pointColors[cp.type] || '#10b981';
            const label = cp.type === 'root' ? `(${cp.x}, 0)` : `${pointLabels[cp.type]}: (${cp.x}, ${cp.y})`;
            const r = cp.type === 'root' ? 5 : 6;
            const labelYOffset = cp.type === 'max' ? -12 : 14;
            return (
              <G key={`cp-${i}`}>
                <Circle cx={sx} cy={sy} r={r} fill={color} stroke="#fff" strokeWidth={2} />
                <SvgText
                  x={sx}
                  y={sy + labelYOffset}
                  fontSize={9}
                  fill={color}
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    flexWrap: 'wrap',
    gap: 4,
  },
  functionLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontFamily: 'monospace',
    flex: 1,
    marginRight: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 4,
  },
  toggleChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleRootActive: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
  },
  toggleStationaryActive: {
    backgroundColor: '#ede9fe',
    borderColor: '#8b5cf6',
  },
  toggleInactive: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
  },
});
