'use client';

import ReactECharts from 'echarts-for-react';

interface HeatmapData {
  subjects: string[];
  students: string[];
  values: number[][];
}

interface HeatmapChartProps {
  data: HeatmapData;
  title?: string;
  loading?: boolean;
}

export default function HeatmapChart({ data, title, loading }: HeatmapChartProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!data || !data.subjects || data.subjects.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const heatmapData: [number, number, number][] = [];
  data.subjects.forEach((_, subjectIdx) => {
    data.students.forEach((_, studentIdx) => {
      heatmapData.push([subjectIdx, studentIdx, data.values[subjectIdx]?.[studentIdx] ?? 0]);
    });
  });

  const option = {
    grid: { left: '10%', right: '4%', bottom: '15%', top: '10%' },
    xAxis: {
      type: 'category',
      data: data.subjects,
      splitArea: { show: true },
      axisLabel: { rotate: 45, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      data: data.students,
      splitArea: { show: true },
      axisLabel: { fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: 100,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '0%',
      inRange: { color: ['#fee2e2', '#fca5a5', '#ef4444', '#b91c1c'] },
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      label: {
        show: true,
        fontSize: 10,
        formatter: (p: any) => p.value[2]?.toFixed(0),
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' },
      },
    }],
    tooltip: {
      position: 'top',
      formatter: (p: any) => {
        const [subjectIdx, studentIdx, value] = p.data;
        return `${data.students[studentIdx]} - ${data.subjects[subjectIdx]}: ${value.toFixed(1)}%`;
      },
    },
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      <ReactECharts option={option} style={{ height: Math.max(300, data.students.length * 40 + 80) }} />
    </div>
  );
}
