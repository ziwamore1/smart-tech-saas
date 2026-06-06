'use client';

import ReactECharts from 'echarts-for-react';

interface ComparisonGroup {
  name: string;
  values: number[];
  color?: string;
}

interface ComparisonChartProps {
  categories: string[];
  groups: ComparisonGroup[];
  title?: string;
  loading?: boolean;
  yAxisLabel?: string;
  horizontal?: boolean;
}

export default function ComparisonChart({
  categories, groups, title, loading, yAxisLabel, horizontal,
}: ComparisonChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!categories || categories.length === 0 || !groups || groups.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const option = {
    grid: { left: horizontal ? '15%' : '8%', right: '8%', bottom: '15%', top: '10%' },
    [horizontal ? 'yAxis' : 'xAxis']: {
      type: 'category',
      data: categories,
      axisLabel: { rotate: horizontal ? 0 : 30, fontSize: 11 },
    },
    [horizontal ? 'xAxis' : 'yAxis']: {
      type: 'value',
      min: 0,
      max: 100,
      name: yAxisLabel,
      nameTextStyle: { fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: groups.map((g, i) => ({
      name: g.name,
      type: 'bar',
      data: g.values,
      barWidth: `${Math.min(80 / groups.length, 30)}%`,
      itemStyle: {
        color: g.color || ['#ea6645', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i],
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
      label: {
        show: true,
        position: horizontal ? 'right' : 'top',
        fontSize: 10,
        formatter: (p: any) => p.value.toFixed(1),
      },
    })),
    legend: {
      data: groups.map(g => g.name),
      bottom: 0,
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const cat = params[0].axisValue;
        let html = `<strong>${cat}</strong><br/>`;
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
