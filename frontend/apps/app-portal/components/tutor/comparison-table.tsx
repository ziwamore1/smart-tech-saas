'use client';

import React from 'react';

interface ComparisonParams {
  title?: string;
  headers: string[];
  rows: string[][];
}

export function ComparisonTable({ params }: { params: ComparisonParams }) {
  const { title, headers, rows } = params;
  if (!headers || headers.length === 0) return null;

  const cols = headers.length;
  const colWidths = cols > 0 ? headers.map((_, i) => `${Math.floor(100 / cols)}%`) : [];

  return (
    <div className="w-full bg-white rounded-lg border border-stone-200 overflow-hidden">
      {title && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
          <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider">{title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-200">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-stone-700 text-[11px]" style={{ width: colWidths[i] }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={`border-b border-stone-100 ${ri % 2 === 0 ? 'bg-white' : 'bg-stone-50'}`}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-stone-600 text-[11px] leading-relaxed">
                    <span className={ci === 0 ? 'font-semibold text-stone-800' : ''}>{cell}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
