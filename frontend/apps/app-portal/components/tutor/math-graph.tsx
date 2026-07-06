'use client';

import { useMemo, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';

interface GraphSpec {
  type: 'linear' | 'quadratic' | 'cubic' | 'polynomial' | 'exponential' | 'logarithmic' | 'trigonometric';
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

function generatePoints(expr: string, domain: [number, number], steps = 300): Array<[number, number]> {
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
      let isSignificant = true;

      if (secondDeriv < -0.001) {
        type = 'max';
      } else if (secondDeriv > 0.001) {
        type = 'min';
      } else {
        type = 'inflection';
        isSignificant = Math.abs(yCurr) + Math.abs(yPrev) > 0.001;
      }

      if (isSignificant) {
        const alreadyFound = criticalPoints.some(cp => Math.abs(cp.x - x) < h * 3);
        if (!alreadyFound) {
          criticalPoints.push({
            x: Math.round(x * 100) / 100,
            y: Math.round(yCurr * 100) / 100,
            type,
          });
        }
      }
    }
  }

  return criticalPoints;
}

function findRoots(expr: string, domain: [number, number]): CriticalPoint[] {
  const yIntercept = evaluateFunction(expr, 0);
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

  if (yIntercept !== null && isFinite(yIntercept) && Math.abs(yIntercept) < 0.01) {
    const already = roots.some(r => Math.abs(r.x) < 0.05);
    if (!already) {
      roots.push({ x: 0, y: 0, type: 'root' });
    }
  }

  return roots;
}

const CRITICAL_POINT_STYLES: Record<string, { symbol: string; color: string; label: string }> = {
  root: { symbol: 'circle', color: '#10b981', label: 'Root' },
  max: { symbol: 'diamond', color: '#ef4444', label: 'Max' },
  min: { symbol: 'diamond', color: '#3b82f6', label: 'Min' },
  inflection: { symbol: 'triangle', color: '#8b5cf6', label: 'Inflection' },
};

export function MathGraph({ spec }: { spec: GraphSpec }) {
  const domain = spec.domain || [-10, 10];
  const [showRoots, setShowRoots] = useState(spec.showIntercepts ?? true);
  const [showStationary, setShowStationary] = useState(spec.showTurningPoint ?? true);

  const toggleRoots = useCallback(() => setShowRoots(v => !v), []);
  const toggleStationary = useCallback(() => setShowStationary(v => !v), []);

  const option = useMemo(() => {
    const points = generatePoints(spec.function, domain);

    const roots = findRoots(spec.function, domain);
    const criticalPoints = findAllCriticalPoints(spec.function, domain);

    const series: any[] = [
      {
        name: spec.function,
        type: 'line',
        data: points.map(([x, y]) => [x, y]),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color: '#f97316' },
        areaStyle: spec.shadedRegion
          ? { color: spec.shadedRegion.color || 'rgba(249, 115, 22, 0.15)' }
          : undefined,
      },
    ];

    const markLines: any[] = [];
    const markPoints: any[] = [];

    if (showRoots) {
      for (const root of roots) {
        markLines.push({
          xAxis: root.x,
          lineStyle: { type: 'dashed', color: '#10b981', width: 1.5 },
          label: {
            formatter: `x = ${root.x}`,
            color: '#10b981',
            fontSize: 11,
            position: 'insideEndTop',
          },
        });
        markPoints.push({
          coord: [root.x, root.y],
          symbol: 'circle',
          symbolSize: 10,
          itemStyle: { color: '#10b981', borderColor: '#fff', borderWidth: 2 },
          label: {
            formatter: `(${root.x}, 0)`,
            color: '#10b981',
            fontSize: 10,
            position: 'top',
          },
        });
      }
    }

    if (showStationary) {
      for (const cp of criticalPoints) {
        if (cp.type === 'root') {
          if (!showRoots) continue;
          continue;
        }
        const style = CRITICAL_POINT_STYLES[cp.type] || CRITICAL_POINT_STYLES.root;
        markPoints.push({
          coord: [cp.x, cp.y],
          symbol: style.symbol,
          symbolSize: cp.type === 'inflection' ? 10 : 12,
          itemStyle: { color: style.color, borderColor: '#fff', borderWidth: 2 },
          label: {
            formatter: `${style.label}: (${cp.x}, ${cp.y})`,
            color: style.color,
            fontSize: 10,
            fontWeight: 'bold',
            position: cp.type === 'max' ? 'top' : 'bottom',
          },
        });
      }
    }

    if (spec.showAsymptotes) {
      for (let i = 1; i < points.length; i++) {
        if (Math.abs(points[i]?.[1]) > 1000 && Math.abs(points[i - 1]?.[1]) <= 1000) {
          markLines.push({
            xAxis: points[i][0],
            lineStyle: { type: 'dashed', color: '#ef4444', width: 1.5 },
            label: {
              formatter: `x = ${Math.round(points[i][0] * 100) / 100}`,
              color: '#ef4444',
              fontSize: 11,
              position: 'insideEndTop',
            },
          });
        }
      }
    }

    if (markLines.length > 0) {
      series[0].markLine = { silent: true, symbol: 'none', data: markLines };
    }
    if (markPoints.length > 0) {
      series[0].markPoint = {
        data: markPoints,
        symbol: 'circle',
        symbolSize: 8,
        label: { show: true },
      };
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          if (!p) return '';
          const val = p.value;
          if (Array.isArray(val)) {
            return `x = ${Number(val[0]).toFixed(4)}<br/>y = ${Number(val[1]).toFixed(4)}`;
          }
          return `x = ${p.axisValueLabel}<br/>y = ${Number(val).toFixed(4)}`;
        },
      },
      grid: { left: 55, right: 25, top: 40, bottom: 50 },
      xAxis: {
        type: 'value',
        name: spec.xLabel || 'x',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: { fontWeight: 'bold', fontSize: 13 },
        min: domain[0],
        max: domain[1],
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        axisLine: { lineStyle: { color: '#374151' } },
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: spec.yLabel || 'y',
        nameLocation: 'middle',
        nameGap: 45,
        nameTextStyle: { fontWeight: 'bold', fontSize: 13 },
        scale: true,
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        axisLine: { lineStyle: { color: '#374151' } },
        axisLabel: { fontSize: 11 },
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        { type: 'inside', yAxisIndex: 0, filterMode: 'filter' },
        {
          type: 'slider',
          xAxisIndex: 0,
          filterMode: 'filter',
          height: 16,
          bottom: 6,
          borderColor: '#d1d5db',
          fillerColor: 'rgba(249, 115, 22, 0.15)',
          handleStyle: { borderColor: '#f97316', color: '#f97316' },
        },
      ],
      toolbox: {
        feature: {
          dataZoom: { yAxisIndex: 'none', title: { zoom: 'Zoom', back: 'Reset' } },
          restore: { title: 'Reset' },
          saveAsImage: { title: 'Save', pixelRatio: 2, name: 'graph' },
        },
        iconStyle: { borderColor: '#6b7280' },
        right: 8,
        top: 4,
      },
      series,
      animation: false,
    };
  }, [
    spec.function,
    domain,
    showRoots,
    showStationary,
    spec.showAsymptotes,
    spec.shadedRegion,
    spec.xLabel,
    spec.yLabel,
  ]);

  const hasRoots = useMemo(() => findRoots(spec.function, domain).length > 0, [spec.function, domain]);
  const hasStationary = useMemo(() => findAllCriticalPoints(spec.function, domain).some(p => p.type !== 'root'), [spec.function, domain]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
        <div className="text-xs text-gray-500 font-mono truncate flex-1">
          f(x) = {spec.function}
        </div>
        <div className="flex items-center gap-1">
          {hasRoots && (
            <button
              onClick={toggleRoots}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
                showRoots
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              Roots
            </button>
          )}
          {hasStationary && (
            <button
              onClick={toggleStationary}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors ${
                showStationary
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}
            >
              Stationary
            </button>
          )}
        </div>
      </div>
      <ReactECharts
        option={option}
        style={{ height: 280, width: '100%' }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
