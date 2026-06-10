"use client";

import { useEffect, useMemo, useState } from "react";
import { timetableApi, schoolApi } from "@/lib/api";
import { getSubjectColor, dayLabels } from "@/config/subjectColors";
import type { TimeSettings } from "@/lib/computePeriodTimes";
import { computePeriodTimes, computeBreakPeriods, getPeriodsPerDay } from "@/lib/computePeriodTimes";

type Slot = {
  id: string;
  day: number;
  period: number;
  subject?: { name: string };
  teacher?: { name: string };
  class?: { name: string };
};

export default function RoomTimetable({
  roomId,
  termId,
}: {
  roomId: string;
  termId: string;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !termId) return;
    loadTimetable();
  }, [roomId, termId]);

  const loadTimetable = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await timetableApi.getRoomTimetable(roomId, termId);

      setSlots(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load room timetable.");
    } finally {
      setLoading(false);
    }
  };

  /* Faster lookup map */
  const slotMap = useMemo(() => {
    const map: Record<string, Slot> = {};

    slots.forEach((slot) => {
      map[`${slot.day}-${slot.period}`] = slot;
    });

    return map;
  }, [slots]);

  const [timeSettings, setTimeSettings] = useState<Partial<TimeSettings> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await schoolApi.getTimeSettings();
        setTimeSettings((res.data?.data || res.data) || null);
      } catch { /* ignore */ }
    })();
  }, []);

  const periodTimesDyn = useMemo(() => computePeriodTimes(timeSettings || {}), [timeSettings]);
  const breakPeriods = useMemo(() => computeBreakPeriods(timeSettings || {}), [timeSettings]);
  const periodsPerDay = useMemo(() => getPeriodsPerDay(timeSettings || {}), [timeSettings]);
  const periods = useMemo(() => Array.from({ length: periodsPerDay }, (_, i) => i + 1), [periodsPerDay]);

  const visualColumns = useMemo(
    () =>
      periods.flatMap((p) =>
        breakPeriods.has(p)
          ? [{ type: "period" as const, period: p }, { type: "break" as const }]
          : [{ type: "period" as const, period: p }]
      ),
    [periods, breakPeriods]
  );

  const getSlot = (day: number, period: number) =>
    slotMap[`${day}-${period}`];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
        <span className="ml-3 text-slate-600">Loading room timetable...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center bg-red-50 border border-red-200 rounded-xl">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={loadTimetable}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">

      <div className="min-w-[900px]">

        {/* HEADER */}
        <div
          className="grid bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200"
          style={{
            gridTemplateColumns: `140px repeat(${visualColumns.length}, minmax(120px, 1fr))`
          }}
        >
          <div className="border-r border-slate-200 p-4 text-center">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Day</div>
            <div className="text-sm font-bold text-slate-700">/ Period</div>
          </div>

          {visualColumns.map((col, idx) => {
            if (col.type === 'break') {
              return (
                <div key={`break-${idx}`} className="border-r border-slate-200 p-3 text-center last:border-r-0 bg-amber-50">
                  <div className="text-sm font-bold text-amber-600">Break</div>
                  <div className="text-xs text-amber-500 mt-0.5">Recess</div>
                </div>
              )
            }
            const pt = periodTimesDyn?.[col.period]
            return (
              <div key={col.period} className="border-r border-slate-200 p-3 text-center last:border-r-0">
                <div className="text-sm font-bold text-slate-700">Period {col.period}</div>
                {pt && <div className="text-xs text-slate-500 mt-0.5">{pt.start}</div>}
              </div>
            )
          })}
        </div>

        {/* ROWS */}
        {dayLabels.slice(0, 5).map((dayObj) => (
          <div
            key={dayObj.id}
            className="grid border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            style={{
              gridTemplateColumns: `140px repeat(${visualColumns.length}, minmax(120px, 1fr))`
            }}
          >
            <div className="border-r border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 flex items-center justify-center">
              <div className="text-center">
                <div className="font-bold text-slate-800">{dayObj.full}</div>
                <div className="text-xs text-slate-500">{dayObj.short}</div>
              </div>
            </div>

            {visualColumns.map((col, idx) => {
              if (col.type === 'break') {
                return (
                  <div
                    key={`break-${dayObj.id}-${idx}`}
                    className="border-r border-slate-100 p-2 min-h-[80px] bg-amber-50/50"
                  >
                    <div className="h-full flex items-center justify-center">
                      <div className="bg-amber-100 rounded-lg px-3 py-2 text-center w-full">
                        <div className="text-xs font-semibold text-amber-600 tracking-wide">BREAK</div>
                      </div>
                    </div>
                  </div>
                )
              }
              const slot = getSlot(dayObj.id, col.period)
              const colorConfig = slot?.subject ? getSubjectColor(slot.subject.name) : null
              
              return (
                <div
                  key={`${dayObj.id}-${col.period}`}
                  className="border-r border-slate-100 p-2 min-h-[80px]"
                >
                  {slot ? (
                    <div className={`
                      h-full rounded-xl p-2.5 flex flex-col
                      ${colorConfig ? `${colorConfig.bg} border ${colorConfig.border}` : 'bg-slate-100 border-slate-200'}
                      shadow-sm hover:shadow-md transition-shadow
                    `}>
                      {slot.subject && (
                        <span className={`font-bold text-sm ${colorConfig ? colorConfig.text : 'text-slate-800'}`}>
                          {slot.subject.name}
                        </span>
                      )}
                      {slot.class && (
                        <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-lg w-fit ${colorConfig ? 'bg-white/60 text-slate-700' : 'bg-slate-200 text-slate-600'}`}>
                          {slot.class.name}
                        </span>
                      )}
                      {slot.teacher && (
                        <span className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {slot.teacher.name}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

      </div>

      {/* Legend */}
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center gap-6 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gradient-to-br from-green-100 to-green-200 border border-green-300 rounded"></span>
            <span>Occupied</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 bg-slate-200 border border-slate-300 rounded"></span>
            <span>Available</span>
          </span>
        </div>
      </div>
    </div>
  );
}
