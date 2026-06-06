'use client';

import { ChartData } from '@/types/communication';

interface HistogramProps {
  data: ChartData;
  title?: string;
}

export default function Histogram({ data, title }: HistogramProps) {
  if (!data || !data.datasets || !data.datasets[0] || !data.datasets[0].data || data.datasets[0].data.length === 0 || !data.labels || data.labels.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
        <div className="text-center py-12 text-gray-500">No data available</div>
      </div>
    );
  }

  const values = data.datasets[0].data;
  const maxValue = Math.max(...values, 1);
  const height = 300;
  const padding = 60;
  const barWidth = 50;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      
      <svg width="100%" height={height} viewBox={`0 0 ${data.labels.length * barWidth + padding * 2} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          const value = Math.round(ratio * maxValue);
          return (
            <g key={ratio}>
              <line
                x1={padding}
                y1={y}
                x2={data.labels.length * barWidth + padding}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="4"
              />
              <text
                x={padding - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="12"
                fill="#6b7280"
              >
                {value}
              </text>
            </g>
          );
        })}

        {data.labels.map((label, index) => {
          const value = values[index] || 0;
          const barHeight = (value / maxValue) * (height - padding * 2);
          const x = padding + index * barWidth;
          const y = height - padding - barHeight;

          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={barWidth - 4}
                height={barHeight}
                fill="rgba(59, 130, 246, 0.6)"
                stroke="rgba(59, 130, 246, 1)"
                strokeWidth="2"
                rx="4"
                className="hover:fill-blue-700 transition-colors cursor-pointer"
              >
                <title>{label}: {value} students</title>
              </rect>
              <text
                x={x + (barWidth - 4) / 2}
                y={y - 8}
                textAnchor="middle"
                fontSize="11"
                fill="#374151"
                fontWeight="500"
              >
                {value}
              </text>
              <text
                x={x + (barWidth - 4) / 2}
                y={height - padding + 20}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {label}
              </text>
            </g>
          );
        })}

        <line
          x1={padding}
          y1={height - padding}
          x2={data.labels.length * barWidth + padding}
          y2={height - padding}
          stroke="#9ca3af"
        />
      </svg>
    </div>
  );
}
