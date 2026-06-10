'use client';

import ReactECharts from 'echarts-for-react';

interface BoxPlotData {
  name: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers?: number[];
}

interface BoxPlotChartProps {
  data: BoxPlotData[];
  title?: string;
  loading?: boolean;
}

export default function BoxPlotChart({ data, title, loading }: BoxPlotChartProps) {
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

  const boxData = data.map(d => [d.min, d.q1, d.median, d.q3, d.max]);
  const outlierData = data.map((d, i) =>
    (d.outliers || []).map(v => [i, v])
  ).flat();

  const option = {
    grid: { left: '8%', right: '8%', bottom: '15%', top: '10%' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.name),
      axisLabel: { rotate: 30, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: '#f3f4f6' } },
    },
    series: [
      {
        type: 'boxplot',
        data: boxData,
        itemStyle: { color: '#ea6645', borderColor: '#c2410c' },
        emphasis: { itemStyle: { borderWidth: 2 } },
      },
      ...(outlierData.length > 0 ? [{
        type: 'scatter',
        data: outlierData,
        symbolSize: 6,
        itemStyle: { color: '#ef4444' },
      }] : []),
    ],
    tooltip: {
      formatter: (p: any) => {
        if (p.seriesType === 'boxplot') {
          const d = p.data;
          return `<strong>${p.name}</strong><br/>
            Min: ${d[1]}<br/>Q1: ${d[2]}<br/>Median: ${d[3]}<br/>Q3: ${d[4]}<br/>Max: ${d[5]}`;
        }
        return `Outlier: ${p.value[1]}`;
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
