'use client';

import { useMemo } from 'react';
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

function evaluateFunction(expr: string, x: number): number | null {
  try {
    const sanitized = expr
      .replace(/\^/g, '**')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/log/g, 'Math.log')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/abs/g, 'Math.abs')
      .replace(/pi/g, `${Math.PI}`)
      .replace(/e(?![xp])/g, `${Math.E}`);
    const fn = new Function('x', `try { return (${sanitized}); } catch { return null; }`);
    return fn(x);
  } catch {
    return null;
  }
}

function generatePoints(expr: string, domain: [number, number], steps = 200): Array<[number, number]> {
  const [min, max] = domain;
  const step = (max - min) / steps;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const x = min + i * step;
    const y = evaluateFunction(expr, x);
    if (y !== null && isFinite(y)) {
      points.push([x, y]);
    }
  }
  return points;
}

function findIntercepts(expr: string, domain: [number, number]): { xIntercepts: number[]; yIntercept: number | null } {
  const yIntercept = evaluateFunction(expr, 0);
  const xIntercepts: number[] = [];
  const points = generatePoints(expr, domain, 400);
  for (let i = 1; i < points.length; i++) {
    const [, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if ((y1 < 0 && y2 >= 0) || (y1 >= 0 && y2 < 0)) {
      const ratio = Math.abs(y1) / (Math.abs(y1) + Math.abs(y2));
      const x = points[i - 1][0] + (x2 - points[i - 1][0]) * ratio;
      xIntercepts.push(Math.round(x * 100) / 100);
    }
  }
  return { xIntercepts, yIntercept: yIntercept !== null && isFinite(yIntercept) ? yIntercept : null };
}

function findTurningPoint(expr: string, domain: [number, number]): { x: number; y: number } | null {
  const points = generatePoints(expr, domain, 300);
  if (points.length < 3) return null;
  let minY = Infinity, maxY = -Infinity;
  let minX = 0, maxX = 0;
  for (const [x, y] of points) {
    if (y < minY) { minY = y; minX = x; }
    if (y > maxY) { maxY = y; maxX = x; }
  }
  const midIdx = Math.floor(points.length / 2);
  const midY = points[midIdx][1];
  if (Math.abs(minY - midY) > Math.abs(maxY - midY)) {
    return { x: Math.round(minX * 100) / 100, y: Math.round(minY * 100) / 100 };
  }
  return { x: Math.round(maxX * 100) / 100, y: Math.round(maxY * 100) / 100 };
}

export function MathGraph({ spec }: { spec: GraphSpec }) {
  const domain = spec.domain || [-10, 10];

  const option = useMemo(() => {
    const points = generatePoints(spec.function, domain);
    const xValues = points.map(([x]) => x);
    const yValues = points.map(([, y]) => y);

    const series: any[] = [
      {
        name: spec.function,
        type: 'line',
        data: points.map(([x, y]) => [x, y]),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color: '#f97316' },
        areaStyle: spec.shadedRegion ? {
          color: spec.shadedRegion.color || 'rgba(249, 115, 22, 0.15)',
        } : undefined,
      },
    ];

    const markLines: any[] = [];
    const markPoints: any[] = [];

    if (spec.showIntercepts) {
      const { xIntercepts, yIntercept } = findIntercepts(spec.function, domain);
      xIntercepts.forEach(x => {
        markLines.push({
          xAxis: x,
          lineStyle: { type: 'dashed', color: '#10b981' },
          label: { formatter: `x = ${x}`, color: '#10b981', fontSize: 11 },
        });
      });
      if (yIntercept !== null) {
        markPoints.push({
          coord: [0, yIntercept],
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#3b82f6' },
          label: { formatter: `y = ${Math.round(yIntercept * 100) / 100}`, color: '#3b82f6', fontSize: 11 },
        });
      }
    }

    if (spec.showTurningPoint) {
      const tp = findTurningPoint(spec.function, domain);
      if (tp) {
        markPoints.push({
          coord: [tp.x, tp.y],
          symbol: 'diamond',
          symbolSize: 10,
          itemStyle: { color: '#8b5cf6' },
          label: { formatter: `(${tp.x}, ${tp.y})`, color: '#8b5cf6', fontSize: 11 },
        });
      }
    }

    if (spec.showAsymptotes) {
      for (let i = 1; i < points.length; i++) {
        if (Math.abs(points[i][1]) > 1000 && Math.abs(points[i - 1][1]) <= 1000) {
          markLines.push({
            xAxis: points[i][0],
            lineStyle: { type: 'dashed', color: '#ef4444' },
            label: { formatter: `x = ${Math.round(points[i][0] * 100) / 100}`, color: '#ef4444', fontSize: 11 },
          });
        }
      }
    }

    if (markLines.length > 0) {
      series[0].markLine = { silent: true, data: markLines };
    }
    if (markPoints.length > 0) {
      series[0].markPoint = { data: markPoints, symbol: 'circle', symbolSize: 8 };
    }

    let yMin = Math.min(...yValues.filter(v => isFinite(v)));
    let yMax = Math.max(...yValues.filter(v => isFinite(v)));
    const yPadding = (yMax - yMin) * 0.1 || 1;
    yMin = isFinite(yMin) ? yMin - yPadding : -10;
    yMax = isFinite(yMax) ? yMax + yPadding : 10;

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0];
          if (!p) return '';
          return `x = ${p.axisValue}<br/>y = ${typeof p.value === 'number' ? p.value.toFixed(4) : p.value[1].toFixed(4)}`;
        },
      },
      grid: {
        left: 50,
        right: 20,
        top: 30,
        bottom: 40,
      },
      xAxis: {
        type: 'value',
        name: spec.xLabel || 'x',
        nameLocation: 'center',
        nameGap: 30,
        min: domain[0],
        max: domain[1],
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        axisLine: { lineStyle: { color: '#6b7280' } },
      },
      yAxis: {
        type: 'value',
        name: spec.yLabel || 'y',
        nameLocation: 'center',
        nameGap: 40,
        min: yMin,
        max: yMax,
        splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        axisLine: { lineStyle: { color: '#6b7280' } },
      },
      series,
      animation: false,
    };
  }, [spec.function, domain, spec.showIntercepts, spec.showTurningPoint, spec.showAsymptotes, spec.shadedRegion, spec.xLabel, spec.yLabel]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500 mb-1 font-mono">f(x) = {spec.function}</div>
      <ReactECharts
        option={option}
        style={{ height: 280, width: '100%' }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}
