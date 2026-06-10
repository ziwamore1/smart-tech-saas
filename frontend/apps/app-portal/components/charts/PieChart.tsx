'use client';

import { ChartData } from '@/types/communication';

interface PieChartProps {
  data: ChartData;
  title?: string;
}

export default function PieChart({ data, title }: PieChartProps) {
  if (!data || !data.datasets || !data.datasets[0] || !data.datasets[0].data || data.datasets[0].data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const total = data.datasets[0].data.reduce((sum, val) => sum + val, 0) || 0;

  const colors = data.datasets[0]?.backgroundColor || [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'
  ];

  let cumulativePercentage = 0;
  const segments = data.datasets[0]?.data.map((value, index) => {
    const percentage = (value / total) * 100;
    const startAngle = cumulativePercentage * 3.6;
    cumulativePercentage += percentage;
    const endAngle = cumulativePercentage * 3.6;
    return {
      label: data.labels[index],
      value,
      percentage,
      startAngle,
      endAngle,
      color: Array.isArray(colors) ? colors[index] : colors,
    };
  }) || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      
      <div className="flex items-center justify-center gap-8">
        <svg width="200" height="200" viewBox="0 0 200 200">
          {segments.map((segment, index) => {
            const startRad = (segment.startAngle - 90) * Math.PI / 180;
            const endRad = (segment.endAngle - 90) * Math.PI / 180;
            const largeArc = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
            
            const x1 = 100 + 80 * Math.cos(startRad);
            const y1 = 100 + 80 * Math.sin(startRad);
            const x2 = 100 + 80 * Math.cos(endRad);
            const y2 = 100 + 80 * Math.sin(endRad);
            
            const pathData = [
              `M 100 100`,
              `L ${x1} ${y1}`,
              `A 80 80 0 ${largeArc} 1 ${x2} ${y2}`,
              `Z`
            ].join(' ');

            return (
              <path
                key={index}
                d={pathData}
                fill={segment.color}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>{segment.label}: {segment.value} ({segment.percentage.toFixed(1)}%)</title>
              </path>
            );
          })}
          <circle cx="100" cy="100" r="40" fill="white" />
        </svg>

        <div className="space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-gray-700">{segment.label}</span>
              <span className="text-sm font-semibold text-gray-900">{segment.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
