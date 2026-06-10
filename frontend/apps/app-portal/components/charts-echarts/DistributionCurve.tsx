'use client';

import ReactECharts from 'echarts-for-react';

interface DistributionCurveProps {
  data: Array<{ value: number; frequency: number }>;
  mean?: number;
  stdDev?: number;
  title?: string;
  loading?: boolean;
}

export default function DistributionCurve({ data, mean, stdDev, title, loading }: DistributionCurveProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const values = data.map(d => d.value);
  const freqs = data.map(d => d.frequency);

  const normalCurve = mean !== undefined && stdDev !== undefined
    ? values.map(v => ({
      value: v,
      density: (1 / (stdDev! * Math.sqrt(2 * Math.PI))) *
        Math.exp(-0.5 * Math.pow((v - mean!) / stdDev!, 2)),
    }))
    : [];

  const maxFreq = Math.max(...freqs);
  const maxDensity = normalCurve.length > 0 ? Math.max(...normalCurve.map(n => n.density)) : 0;
  const scaleFactor = maxFreq / (maxDensity || 1);

  const option = {
    grid: { left: '8%', right: '8%', bottom: '12%', top: '10%' },
    xAxis: {
      type: 'category',
      data: values.map(v => v.toFixed(0)),
      axisLabel: { fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#f3f4f6' } },
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        name: 'Actual Distribution',
        type: 'bar',
        data: freqs,
        itemStyle: { color: '#ea6645', opacity: 0.7 },
        barWidth: '70%',
      },
      ...(normalCurve.length > 0 ? [{
        name: 'Normal Curve',
        type: 'line',
        data: normalCurve.map(n => n.density * scaleFactor),
        smooth: true,
        lineStyle: { color: '#3b82f6', width: 2.5 },
        symbol: 'none',
        areaStyle: { color: 'rgba(59,130,246,0.1)' },
      }] : []),
    ],
    legend: {
      data: ['Actual Distribution', ...(normalCurve.length > 0 ? ['Normal Curve'] : [])],
      bottom: 0,
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      formatter: (p: any) => {
        const idx = values[parseInt(p.dataIndex)];
        return `<strong>Score: ${idx}</strong><br/>
          Frequency: ${p.value}<br/>
          ${mean !== undefined ? `Mean: ${mean.toFixed(1)}` : ''}`;
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
