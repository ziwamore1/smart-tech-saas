'use client';

import ReactECharts from 'echarts-for-react';

interface TrendPoint {
  label: string;
  value: number;
  predicted?: boolean;
}

interface TrendLine {
  name: string;
  data: TrendPoint[];
  color?: string;
}

interface TrendChartProps {
  lines: TrendLine[];
  title?: string;
  loading?: boolean;
  yAxisLabel?: string;
}

export default function TrendChart({ lines, title, loading, yAxisLabel }: TrendChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!lines || lines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const allLabels = lines[0].data.map(d => d.label);

  const series = lines.flatMap(line => {
    const actualData = line.data.filter(d => !d.predicted).map(d => d.value);
    const predictedData = line.data.map((d, i) => d.predicted ? d.value : null);

    const baseColor = line.color || '#ea6645';
    const dashedColor = line.color || '#ea6645';

    return [
      {
        name: line.name,
        type: 'line',
        data: actualData,
        smooth: true,
        lineStyle: { color: baseColor, width: 2.5 },
        itemStyle: { color: baseColor },
        symbol: 'circle',
        symbolSize: 7,
      },
      {
        name: `${line.name} (Predicted)`,
        type: 'line',
        data: predictedData.length > 0 && predictedData.some(d => d !== null)
          ? predictedData
          : undefined,
        smooth: true,
        connectNulls: true,
        lineStyle: { color: dashedColor, width: 2, type: 'dashed' },
        itemStyle: { color: dashedColor },
        symbol: 'diamond',
        symbolSize: 8,
      },
    ].filter(s => s.data !== undefined);
  });

  const option = {
    grid: { left: '8%', right: '8%', bottom: '12%', top: '10%' },
    xAxis: {
      type: 'category',
      data: allLabels,
      axisLabel: { fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      name: yAxisLabel || 'Score (%)',
      nameTextStyle: { fontSize: 11 },
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series,
    legend: {
      data: lines.flatMap(l => [l.name, `${l.name} (Predicted)`]),
      bottom: 0,
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const label = params[0].axisValue;
        let html = `<strong>${label}</strong><br/>`;
        params.forEach((p: any) => {
          if (p.value !== null && p.value !== undefined) {
            html += `${p.marker} ${p.seriesName}: ${p.value.toFixed(1)}<br/>`;
          }
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
