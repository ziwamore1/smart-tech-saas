'use client';

import { ChartData } from '@/types/communication';

interface BarChartProps {
  data: ChartData;
  title?: string;
}

export default function BarChart({ data, title }: BarChartProps) {
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
  const barWidth = 40;
  const padding = 60;

  const colors = data.datasets.map((dataset) =>
    Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor : 
    dataset.backgroundColor || '#3b82f6'
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      
      <svg width="100%" height={height} viewBox={`0 0 ${data.labels.length * barWidth * data.datasets.length + padding * 2 + data.labels.length * 10} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = height - padding - ratio * (height - padding * 2);
          const value = (ratio * maxValue).toFixed(0);
          return (
            <g key={ratio}>
              <line
                x1={padding}
                y1={y}
                x2={data.labels.length * (barWidth * data.datasets.length + 10) + padding}
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

        {data.labels.map((label, labelIndex) => {
          return data.datasets.map((dataset, datasetIndex) => {
            const value = dataset.data[labelIndex] || 0;
            const barHeight = (value / maxValue) * (height - padding * 2);
            const x = padding + labelIndex * (barWidth * data.datasets.length + 10) + datasetIndex * barWidth;
            const y = height - padding - barHeight;
            const color = Array.isArray(colors[datasetIndex]) 
              ? colors[datasetIndex][labelIndex] 
              : colors[datasetIndex];

            return (
              <g key={`${labelIndex}-${datasetIndex}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth - 4}
                  height={barHeight}
                  fill={color}
                  rx="4"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <title>{dataset.label}: {value}</title>
                </rect>
              </g>
            );
          });
        })}

        <line
          x1={padding}
          y1={height - padding}
          x2={data.labels.length * (barWidth * data.datasets.length + 10) + padding}
          y2={height - padding}
          stroke="#9ca3af"
        />

        {data.labels.map((label, index) => {
          const x = padding + index * (barWidth * data.datasets.length + 10) + (barWidth * data.datasets.length) / 2;
          return (
            <text
              key={index}
              x={x}
              y={height - padding + 20}
              textAnchor="middle"
              fontSize="11"
              fill="#6b7280"
            >
              {label.length > 8 ? label.substring(0, 8) + '..' : label}
            </text>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-4 mt-4 justify-center">
        {data.datasets.map((dataset, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: Array.isArray(colors[index]) ? colors[index][0] : colors[index] }}
            />
            <span className="text-sm text-gray-700">{dataset.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
