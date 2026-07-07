'use client';

import React from 'react';

interface FlowNode {
  id: string;
  label: string;
  description?: string;
}

interface FlowConnection {
  from: string;
  to: string;
}

interface FlowChartParams {
  title?: string;
  nodes: FlowNode[];
  connections?: FlowConnection[];
}

export function FlowChart({ params }: { params: FlowChartParams }) {
  const { title, nodes, connections = [] } = params;
  
  const cols = Math.min(nodes.length, 4);
  const rows = Math.ceil(nodes.length / cols);

  return (
    <div className="w-full bg-white rounded-lg border border-stone-200 p-4">
      {title && (
        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-4">{title}</h4>
      )}
      <svg viewBox="0 0 260 200" className="w-full max-w-[260px] mx-auto">
        {/* Connections (arrows) */}
        {connections.map((conn, i) => {
          const fromNode = nodes.find(n => n.id === conn.from);
          const toNode = nodes.find(n => n.id === conn.to);
          if (!fromNode || !toNode) return null;
          const fromIdx = nodes.indexOf(fromNode);
          const toIdx = nodes.indexOf(toNode);
          const fromX = 30 + (fromIdx % cols) * 60;
          const fromY = 20 + Math.floor(fromIdx / cols) * 60;
          const toX = 30 + (toIdx % cols) * 60;
          const toY = 20 + Math.floor(toIdx / cols) * 60;
          return (
            <g key={i}>
              <line
                x1={fromX + 40} y1={fromY + 20}
                x2={toX} y2={toY + 20}
                stroke="#d97706" strokeWidth="1.5" strokeDasharray="4,2"
              />
              <polygon
                points={`${toX - 2},${toY + 15} ${toX + 6},${toY + 20} ${toX - 2},${toY + 25}`}
                fill="#d97706"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = 30 + col * 60;
          const y = 20 + row * 60;
          return (
            <g key={node.id}>
              <rect x={x} y={y} width="40" height="30" rx="6" fill="#fff7ed" stroke="#f97316" strokeWidth="1.5" />
              <text x={x + 20} y={y + 18} textAnchor="middle" fontSize="7" fill="#9a3412" fontWeight="600">
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      {nodes.length > 0 && (
        <div className="mt-2 space-y-1">
          {nodes.map(node => (
            <div key={node.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-400 flex-shrink-0" />
              <span className="text-[10px] font-medium text-stone-600">{node.id}. {node.label}</span>
              {node.description && (
                <span className="text-[9px] text-stone-400">— {node.description}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
