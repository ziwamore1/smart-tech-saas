'use client';

import ReactECharts from 'echarts-for-react';

interface RadarIndicator {
  name: string;
  max: number;
}

interface RadarSeries {
  name: string;
  value: number[];
  color?: string;
}

interface RadarChartProps {
  indicators: RadarIndicator[];
  series: RadarSeries[];
  title?: string;
  loading?: boolean;
}

const DEFAULT_COLORS = ['#ea6645', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function RadarChart({ indicators, series, title, loading }: RadarChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!indicators || indicators.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const option = {
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#374151', fontSize: 12 },
      splitArea: {
        areaStyle: { color: ['rgba(234,102,69,0.02)', 'rgba(234,102,69,0.05)'] },
      },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
    },
    series: [{
      type: 'radar',
      data: series.map((s, i) => ({
        name: s.name,
        value: s.value,
        lineStyle: { color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], width: 2 },
        areaStyle: { color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length], opacity: 0.15 },
        itemStyle: { color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] },
      })),
    }],
    legend: {
      data: series.map(s => s.name),
      bottom: 0,
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      formatter: (p: any) => {
        const s = p.seriesName || 'Competency';
        return `<strong>${s}</strong><br/>` + p.value.map((v: number, i: number) =>
          `${indicators[i].name}: ${v.toFixed(1)}`
        ).join('<br/>');
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ReactECharts option={option} style={{ height: 380 }} />
    </div>
  );
}
