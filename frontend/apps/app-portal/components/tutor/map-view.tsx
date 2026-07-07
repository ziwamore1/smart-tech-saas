'use client';

import React, { useState } from 'react';

interface MapMarker {
  label: string;
  cx: number;
  cy: number;
  description?: string;
}

interface MapRegion {
  label: string;
  path: string;
  color?: string;
}

interface MapParams {
  title?: string;
  region?: string;
  markers?: MapMarker[];
  regions?: MapRegion[];
}

export function MapView({ params }: { params: MapParams }) {
  const { title, markers = [], regions = [] } = params;
  const [activeMarker, setActiveMarker] = useState<number | null>(null);

  return (
    <div className="w-full bg-white rounded-lg border border-stone-200 p-4">
      {title && (
        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-4">{title}</h4>
      )}
      <div className="relative">
        <svg viewBox="0 0 260 200" className="w-full max-w-[260px] mx-auto">
          {/* Base map outline */}
          <rect x="10" y="10" width="240" height="180" rx="8" fill="#fefce8" stroke="#d6d3d1" strokeWidth="1" />
          
          {/* Grid lines for reference */}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h${i}`} x1="10" y1={10 + i * 45} x2="250" y2={10 + i * 45} stroke="#e7e5e4" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`v${i}`} x1={10 + i * 60} y1="10" x2={10 + i * 60} y2="190" stroke="#e7e5e4" strokeWidth="0.5" />
          ))}
          
          {/* Regions */}
          {regions.map((r, i) => (
            <path key={i} d={r.path} fill={r.color || '#fef3c7'} stroke="#d97706" strokeWidth="1" opacity="0.7" />
          ))}
          
          {/* Markers */}
          {markers.map((m, i) => (
            <g key={i} onClick={() => setActiveMarker(activeMarker === i ? null : i)} style={{ cursor: 'pointer' }}>
              <circle cx={m.cx} cy={m.cy} r={activeMarker === i ? 8 : 6} fill={activeMarker === i ? '#ea580c' : '#f97316'} stroke="#fff" strokeWidth="2" />
              {activeMarker === i && (
                <>
                  <line x1={m.cx} y1={m.cy + 8} x2={m.cx} y2={m.cy + 25} stroke="#ea580c" strokeWidth="1" />
                  <rect x={m.cx - 45} y={m.cy + 22} width="90" height="20" rx="4" fill="#fff7ed" stroke="#ea580c" strokeWidth="1" />
                  <text x={m.cx} y={m.cy + 35} textAnchor="middle" fontSize="9" fill="#9a3412" fontWeight="600">{m.label}</text>
                </>
              )}
              <text x={m.cx} y={m.cy - 10} textAnchor="middle" fontSize="8" fill="#78716c" fontWeight="500">{m.label}</text>
            </g>
          ))}
        </svg>
      </div>
      {activeMarker !== null && markers[activeMarker]?.description && (
        <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
          <p className="text-xs text-amber-900">{markers[activeMarker].description}</p>
        </div>
      )}
      <p className="text-[10px] text-stone-400 italic mt-2 text-center">Tap markers for details</p>
    </div>
  );
}
