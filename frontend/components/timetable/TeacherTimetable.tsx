"use client";

import { useQuery } from "@tanstack/react-query";
import { timetableApi, schoolApi } from "@/lib/api";
import { useState, Fragment, useMemo } from "react";
import { getSubjectColor, dayLabels } from "@/config/subjectColors";
import type { TimeSettings } from "@/lib/computePeriodTimes";
import { computePeriodTimes, computeBreakPeriods, getPeriodsPerDay } from "@/lib/computePeriodTimes";

interface Slot {
  id: string;
  day: number;
  period: number;
  subject: {
    name: string;
    id: string;
  };
  teacher: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
  classroom?: {
    name: string;
  };
  timetable: {
    class: {
      name: string;
    };
  };
}

type TeacherTimetableData = Slot[];

export default function TeacherTimetable({ 
  teacherId, 
  termId,
  showClassName = true 
}: { 
  teacherId?: string; 
  termId?: string;
  showClassName?: boolean;
}) {
  const [selectedTerm, setSelectedTerm] = useState(termId || "");

  const { data: slots = [], isLoading, error } = useQuery<TeacherTimetableData>({
    queryKey: ["teacherTimetable", teacherId, selectedTerm],
    queryFn: async () => {
      if (teacherId) {
        const res = await timetableApi.getTeacherTimetable(teacherId, selectedTerm || "");
        return res.data;
      } else {
        // Use my-timetable endpoint for teacher's own view
        const res = await timetableApi.getMyTimetable(selectedTerm || undefined);
        return res.data;
      }
    },
    enabled: !!(teacherId || !teacherId), // Allow both cases
  });

  const { data: timeSettings } = useQuery({
    queryKey: ["tt-time-settings"],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      return (res.data?.data || res.data) as Partial<TimeSettings>;
    },
    retry: false,
  });

  const periodTimesDyn = useMemo(() => computePeriodTimes(timeSettings || {}), [timeSettings]);
  const breakPeriods = useMemo(() => computeBreakPeriods(timeSettings || {}), [timeSettings]);
  const periodsPerDay = useMemo(() => getPeriodsPerDay(timeSettings || {}), [timeSettings]);
  const PERIODS = useMemo(() => Array.from({ length: periodsPerDay }, (_, i) => i + 1), [periodsPerDay]);

  const getSlot = (day: number, period: number): Slot | undefined => {
    return slots.find((s: Slot) => s.day === day && s.period === period);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-slate-600">Loading your timetable...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-600">Failed to load timetable. Please try again.</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-8 bg-slate-50 border border-slate-200 rounded-xl text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-slate-600 text-lg font-medium">No timetable assigned for this term.</p>
        <p className="text-slate-500 text-sm mt-2">Please contact the school administrator.</p>
      </div>
    );
  }

  // Group slots by day for summary
  const slotsByDay = dayLabels.slice(0, 5).map((dayObj) => {
    const daySlots = slots.filter((s: Slot) => s.day === dayObj.id);
    return {
      day: dayObj.full,
      short: dayObj.short,
      count: daySlots.length,
      subjects: [...new Set(daySlots.map((s: Slot) => s.subject.name))],
    };
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl border overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Timetable
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              {slots.length} lesson{slots.length !== 1 ? 's' : ''} scheduled this term
            </p>
          </div>
          {selectedTerm && (
            <div className="text-sm bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur">
              Term: {selectedTerm.slice(0, 8)}...
            </div>
          )}
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Weekly Summary
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {slotsByDay.map((day, idx) => (
            <div key={idx} className="text-center bg-white rounded-xl p-3 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{day.short}</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">{day.count}</div>
              <div className="text-xs text-slate-500">{day.subjects.length} subject{day.subjects.length !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Timetable Grid - Enhanced Style */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 p-3 text-left text-sm font-semibold text-slate-700 w-20">
                Period
              </th>
              {dayLabels.slice(0, 5).map((dayObj, idx) => (
                <th
                  key={idx}
                  className="border border-slate-200 p-3 text-center text-sm font-semibold text-slate-700"
                >
                  <div>{dayObj.full}</div>
                  <div className="text-xs font-normal text-slate-500">{dayObj.short}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.flatMap((period) => {
              const pt = periodTimesDyn?.[period]
              const rows = [
                <tr key={period} className="hover:bg-slate-50 transition-colors">
                  <td className="border border-slate-200 p-3 text-center font-medium text-slate-600 bg-slate-50">
                    <div className="text-lg font-bold">P{period}</div>
                    {pt && <div className="text-xs text-slate-400">{pt.start}</div>}
                  </td>
                  {dayLabels.slice(0, 5).map((_, dayIdx) => {
                    const slot = getSlot(dayIdx + 1, period);
                    const colorConfig = slot ? getSubjectColor(slot.subject.name) : null;
                    return (
                      <td
                        key={`${dayIdx}-${period}`}
                        className={`border border-slate-200 p-2 min-w-[150px] ${
                          slot ? "" : "bg-slate-30"
                        }`}
                      >
                        {slot ? (
                          <div className={`
                            rounded-xl p-3 flex flex-col
                            ${colorConfig ? `${colorConfig.bg} border ${colorConfig.border}` : 'bg-slate-100 border-slate-200'}
                            shadow-sm hover:shadow-md transition-shadow
                          `}>
                            <span className={`font-bold text-sm ${colorConfig ? colorConfig.text : 'text-slate-800'}`}>
                              {slot.subject.name}
                            </span>
                            {showClassName && slot.timetable?.class && (
                              <span className={`text-xs mt-1.5 inline-block px-2 py-0.5 rounded-lg w-fit ${colorConfig ? 'bg-white/60 text-slate-700' : 'bg-slate-200 text-slate-600'}`}>
                                {slot.timetable.class.name}
                              </span>
                            )}
                            {slot.classroom && (
                              <span className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                {slot.classroom.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ]

              if (breakPeriods.has(period)) {
                rows.push(
                  <tr key={`break-after-${period}`} className="bg-amber-50/50">
                    <td className="border border-slate-200 p-3 text-center font-medium bg-amber-50">
                      <div className="text-lg font-bold text-amber-600">Break</div>
                      <div className="text-xs text-amber-500">Recess</div>
                    </td>
                    <td colSpan={5} className="border border-slate-200 p-3 text-center bg-amber-50/30">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-amber-600 font-medium">Break / Recess</span>
                      </div>
                    </td>
                  </tr>
                )
              }

              return rows
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-center gap-6 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 rounded"></span>
            <span>Teaching Period</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 bg-slate-200 border border-slate-300 rounded"></span>
            <span>Free Period</span>
          </span>
        </div>
      </div>
    </div>
  );
}
