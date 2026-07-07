'use client';

import React, { useState } from 'react';

interface Figure {
  name: string;
  role?: string;
  description?: string;
  image_hint?: string;
}

interface PortraitParams {
  title?: string;
  figures: Figure[];
}

export function PortraitCard({ params }: { params: PortraitParams }) {
  const { title, figures } = params;
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="w-full bg-white rounded-lg border border-stone-200 p-4">
      {title && (
        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-4">{title}</h4>
      )}
      <div className="grid grid-cols-2 gap-3">
        {figures.map((fig, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 cursor-pointer transition-all ${
              expanded === i
                ? 'border-amber-300 bg-amber-50 shadow-sm'
                : 'border-stone-200 bg-stone-50 hover:border-amber-200 hover:bg-amber-50/50'
            }`}
            onClick={() => setExpanded(expanded === i ? null : i)}
          >
            {/* Avatar placeholder */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 mx-auto flex items-center justify-center">
              <span className="text-lg font-bold text-amber-600">
                {fig.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <h5 className="text-xs font-bold text-stone-800 text-center mt-2">{fig.name}</h5>
            {fig.role && (
              <p className="text-[10px] text-stone-500 text-center italic">{fig.role}</p>
            )}
            {expanded === i && fig.description && (
              <p className="text-[11px] text-stone-600 mt-2 leading-relaxed border-t border-amber-200 pt-2">
                {fig.description}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-stone-400 italic mt-3 text-center">Tap a figure to learn more</p>
    </div>
  );
}
