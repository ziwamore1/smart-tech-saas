'use client';

import ReactECharts from 'echarts-for-react';

interface CohortEntry {
  term: string;
  average: number;
  passRate: number;
  studentCount: number;
}

interface CohortSeries {
  name: string;
  data: number[];
  color?: string;
}

interface CohortChartProps {
  terms: string[];
  series: CohortSeries[];
  title?: string;
  loading?: boolean;
}

export default function CohortChart({ terms, series, title, loading }: CohortChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!terms || terms.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const option = {
    grid: { left: '8%', right: '8%', bottom: '15%', top: '10%' },
    xAxis: {
      type: 'category',
      data: terms,
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: i === 0 ? 'bar' : 'line',
      data: s.data,
      barWidth: '30%',
      itemStyle: {
        color: s.color || (i === 0 ? '#ea6645' : '#3b82f6'),
        borderRadius: i === 0 ? [4, 4, 0, 0] : undefined,
      },
      lineStyle: i > 0 ? { color: s.color || '#3b82f6', width: 2.5 } : undefined,
      symbol: i > 0 ? 'circle' : 'none',
      symbolSize: 8,
      smooth: true,
    })),
    legend: {
      data: series.map(s => s.name),
      bottom: 0,
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const term = params[0].axisValue;
        let html = `<strong>${term}</strong><br/>`;
        params.forEach((p: any) => {
          html += `${p.marker} ${p.seriesName}: ${p.value.toFixed(1)}<br/>`;
        });
        return html;
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
