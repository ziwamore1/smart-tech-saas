'use client';

import React, { useState } from 'react';

interface TimelineEvent {
  year: string;
  title: string;
  description?: string;
}

interface TimelineParams {
  title?: string;
  events: TimelineEvent[];
}

export function Timeline({ params }: { params: TimelineParams }) {
  const { title, events } = params;
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);

  return (
    <div className="w-full bg-white rounded-lg border border-stone-200 p-4">
      {title && (
        <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-4">{title}</h4>
      )}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-amber-200" />
        
        <div className="space-y-4">
          {events.map((event, i) => (
            <div key={i} className="relative pl-10">
              {/* Dot on timeline */}
              <div
                className={`absolute left-[9px] top-1 w-3 h-3 rounded-full border-2 cursor-pointer transition-colors ${
                  selectedEvent === i
                    ? 'bg-amber-500 border-amber-600'
                    : 'bg-white border-amber-400 hover:bg-amber-100'
                }`}
                onClick={() => setSelectedEvent(selectedEvent === i ? null : i)}
              />
              {/* Event card */}
              <div
                className={`rounded-lg p-3 transition-all cursor-pointer ${
                  selectedEvent === i
                    ? 'bg-amber-50 border border-amber-200 shadow-sm'
                    : 'bg-stone-50 border border-stone-200 hover:border-amber-200'
                }`}
                onClick={() => setSelectedEvent(selectedEvent === i ? null : i)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                    {event.year}
                  </span>
                  <span className="text-sm font-semibold text-stone-800">{event.title}</span>
                </div>
                {selectedEvent === i && event.description && (
                  <p className="mt-2 text-xs text-stone-600 leading-relaxed">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-stone-400 italic mt-3 text-center">Click events to learn more</p>
    </div>
  );
}
