'use client';

import React, { useState } from 'react';

interface MindMapNode {
  label: string;
  children?: string[];
}

interface MindMapParams {
  title?: string;
  center: string;
  nodes: MindMapNode[];
}

export function MindMap({ params }: { params: MindMapParams }) {
  const { title, center, nodes } = params;
  const [activeNode, setActiveNode] = useState<number | null>(null);

  return (
    <div className="w-full bg-white rounded-lg border border-stone-200 p-4">
      {title && (
        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-4">{title}</h4>
      )}
      <svg viewBox="0 0 260 200" className="w-full max-w-[260px] mx-auto">
        {/* Center node */}
        <circle cx="130" cy="30" r="18" fill="#f97316" />
        <text x="130" y="34" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">{center}</text>

        {/* Branch lines and child nodes */}
        {nodes.map((node, i) => {
          const angle = (i / nodes.length) * 2 * Math.PI - Math.PI / 2;
          const endX = 130 + 55 * Math.cos(angle);
          const endY = 30 + 55 * Math.sin(angle);
          const childStartY = endY + 14;

          return (
            <g key={i}>
              <line x1="130" y1="48" x2={endX} y2={endY} stroke="#d97706" strokeWidth="1.5" />
              <rect
                x={endX - 22}
                y={endY - 8}
                width="44"
                height="16"
                rx="4"
                fill={activeNode === i ? '#fff7ed' : '#fefce8'}
                stroke={activeNode === i ? '#ea580c' : '#d97706'}
                strokeWidth="1.5"
                onClick={() => setActiveNode(activeNode === i ? null : i)}
                style={{ cursor: 'pointer' }}
              />
              <text
                x={endX}
                y={endY + 4}
                textAnchor="middle"
                fontSize="6"
                fill="#9a3412"
                fontWeight="600"
                onClick={() => setActiveNode(activeNode === i ? null : i)}
                style={{ cursor: 'pointer' }}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Details panel for active node */}
        {activeNode !== null && nodes[activeNode]?.children && (
          <g>
            <rect x="40" y="130" width="180" height="60" rx="6" fill="#fff7ed" stroke="#ea580c" strokeWidth="1" />
            <text x="130" y="145" textAnchor="middle" fontSize="7" fill="#c2410c" fontWeight="700">
              {nodes[activeNode].label}
            </text>
            {nodes[activeNode].children!.map((child, ci) => (
              <text key={ci} x="55" y={158 + ci * 14} fontSize="6" fill="#78716c">
                • {child}
              </text>
            ))}
          </g>
        )}
      </svg>
      {activeNode === null && (
        <p className="text-[10px] text-stone-400 italic mt-2 text-center">Tap a branch to explore</p>
      )}
    </div>
  );
}
