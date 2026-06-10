"use client";

import { useEffect, useMemo, useState } from "react";
import TimetableCell from "./TimetableCell";
import { Slot } from "@/types/timetable";
import { dayLabels } from "@/config/subjectColors";
import { timetableApi, schoolApi } from "@/lib/api";
import type { TimeSettings } from "@/lib/computePeriodTimes";
import { computePeriodTimes, computeBreakPeriods, getPeriodsPerDay } from "@/lib/computePeriodTimes";

type Props = {
  classId: string;
  termId: string;
};

export default function TimetableGrid({ classId, termId }: Props) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeSettings, setTimeSettings] = useState<Partial<TimeSettings> | null>(null);

  useEffect(() => {
    if (!classId || !termId) return;
    loadTimetable();
    loadTimeSettings();
  }, [classId, termId]);

  const loadTimeSettings = async () => {
    try {
      const res = await schoolApi.getTimeSettings();
      const d = res.data?.data || res.data;
      setTimeSettings(d || null);
    } catch (e) {
      console.warn("Failed to load time settings, using defaults", e);
    }
  };

  const loadTimetable = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await timetableApi.getClassTimetable(classId, termId);

      setSlots(res.data?.slots || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load timetable.");
    } finally {
      setLoading(false);
    }
  };

  const periodTimes = useMemo(
    () => computePeriodTimes(timeSettings || {}),
    [timeSettings]
  );
  const breakPeriods = useMemo(
    () => computeBreakPeriods(timeSettings || {}),
    [timeSettings]
  );
  const periodsPerDay = useMemo(
    () => getPeriodsPerDay(timeSettings || {}),
    [timeSettings]
  );

  const periods = useMemo(
    () => Array.from({ length: periodsPerDay }, (_, i) => i + 1),
    [periodsPerDay]
  );

  const visualColumns = useMemo(
    () =>
      periods.flatMap((p) =>
        breakPeriods.has(p)
          ? [{ type: "period" as const, period: p }, { type: "break" as const }]
          : [{ type: "period" as const, period: p }]
      ),
    [periods, breakPeriods]
  );

  const slotMap = useMemo(() => {
    const map: Record<string, Slot> = {};
    slots.forEach((slot) => {
      map[`${slot.day}-${slot.period}`] = slot;
    });
    return map;
  }, [slots]);

  const getSlot = (day: number, period: number) =>
    slotMap[`${day}-${period}`];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-slate-600">Loading timetable...</span>
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
                <div
                  key={`break-${idx}`}
                  className="border-r border-slate-200 p-3 text-center last:border-r-0 bg-amber-50"
                >
                  <div className="text-sm font-bold text-amber-600">Break</div>
                  <div className="text-xs text-amber-500 mt-0.5">Recess</div>
                </div>
              )
            }
            const pt = periodTimes?.[col.period]
            return (
              <div
                key={`header-${col.period}`}
                className="border-r border-slate-200 p-3 text-center last:border-r-0"
              >
                <div className="text-sm font-bold text-slate-700">Period {col.period}</div>
                {pt && (
                  <div className="text-xs text-slate-500 mt-0.5">{pt.start}</div>
                )}
              </div>
            )
          })}
        </div>

        {/* ROWS */}
        {dayLabels.slice(0, 5).map((dayObj) => (
          <div
            key={`row-${dayObj.id}`}
            className="grid border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            style={{
              gridTemplateColumns: `140px repeat(${visualColumns.length}, minmax(120px, 1fr))`
            }}
          >
            {/* DAY LABEL */}
            <div className="border-r border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4 flex items-center justify-center">
              <div className="text-center">
                <div className="font-bold text-slate-800">{dayObj.full}</div>
                <div className="text-xs text-slate-500">{dayObj.short}</div>
              </div>
            </div>

            {visualColumns.map((col, idx) => {
              if (col.type === 'break') {
                return (
                  <div key={`break-${dayObj.id}-${idx}`} className="border-r border-slate-100 p-1 bg-amber-50/50">
                    <div className="h-full flex items-center justify-center">
                      <div className="bg-amber-100 rounded-lg px-3 py-2 text-center w-full">
                        <div className="text-xs font-semibold text-amber-600 tracking-wide">BREAK</div>
                      </div>
                    </div>
                  </div>
                )
              }
              const slot = getSlot(dayObj.id, col.period);
              return (
                <div key={`${dayObj.id}-${col.period}`} className="border-r border-slate-100 p-1">
                  <TimetableCell
                    slot={slot}
                    day={dayObj.id}
                    period={col.period}
                    refresh={loadTimetable}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
