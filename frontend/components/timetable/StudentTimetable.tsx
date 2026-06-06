"use client";

import { useQuery } from "@tanstack/react-query";
import { timetableApi, schoolApi } from "@/lib/api";
import { useState, Fragment, useMemo } from "react";
import { abbreviateSubject, abbreviateTeacher } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
}

interface TimetableData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  class: {
    id: string;
    name: string;
  };
  slots: Slot[];
}

export default function StudentTimetable({ termId }: { termId?: string }) {
  const [selectedTerm, setSelectedTerm] = useState(termId || "");

  const { data: ts } = useQuery({
    queryKey: ["student-tt-settings"],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      const d = res.data?.data || res.data;
      return {
        periodsPerDay: d.periodsPerDay || 8,
        breakAfterPeriod: d.breakAfterPeriod ?? 4,
        breakDuration: d.breakDuration || 20,
        breaks: (d.breaks && d.breaks.length > 0)
          ? d.breaks
          : (d.breakAfterPeriod && d.breakAfterPeriod > 0
              ? [{ afterPeriod: d.breakAfterPeriod, duration: d.breakDuration || 20, name: 'Break' }]
              : []),
      };
    },
    retry: false,
  });

  const breakAfterSet = useMemo(() => {
    if (!ts) return new Set<number>();
    return new Set((ts.breaks || []).map((b: any) => b.afterPeriod));
  }, [ts]);

  const periodsPerDay = ts?.periodsPerDay || 8;
  const PERIODS = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

  const { data, isLoading, error } = useQuery<TimetableData>({
    queryKey: ["studentTimetable", selectedTerm],
    queryFn: async () => {
      const res = await timetableApi.getStudentTimetable(selectedTerm || undefined);
      return res.data;
    },
  });

  const getSlot = (day: number, period: number): Slot | undefined => {
    if (!data?.slots) return undefined;
    return data.slots.find((s) => s.day === day && s.period === period);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading timetable...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600">Failed to load timetable. Please try again.</p>
      </div>
    );
  }

  if (!data?.slots || data.slots.length === 0) {
    return (
      <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600 text-lg">No timetable available for this term.</p>
        <p className="text-gray-500 text-sm mt-2">Please contact your school administrator.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {data.student.firstName} {data.student.lastName}
            </h2>
            <p className="text-blue-100 text-sm">
              Class: {data.class?.name || "Not assigned"} | Admission: {data.student.admissionNumber}
            </p>
          </div>
          {selectedTerm && (
            <div className="text-sm bg-blue-800 px-3 py-1 rounded">
              Term ID: {selectedTerm.slice(0, 8)}...
            </div>
          )}
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 p-3 text-left text-sm font-semibold text-gray-700 w-20">
                Period
              </th>
              {DAYS.slice(0, 5).map((day, idx) => (
                <th
                  key={idx}
                  className="border border-gray-200 p-3 text-center text-sm font-semibold text-gray-700"
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.flatMap((period) => {
              const rows = [
                <tr key={period} className="hover:bg-gray-50">
                  <td className="border border-gray-200 p-3 text-center font-medium text-gray-600 bg-gray-50">
                    {period}
                  </td>
                  {DAYS.slice(0, 5).map((_, dayIdx) => {
                    const slot = getSlot(dayIdx + 1, period);
                    return (
                      <td
                        key={`${dayIdx}-${period}`}
                        className={`border border-gray-200 p-2 min-w-[120px] ${
                          slot ? "bg-blue-50" : "bg-gray-30"
                        }`}
                      >
                        {slot ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-blue-800 text-sm st-subject">
                              <TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap>
                            </span>
                            <span className="text-xs text-gray-600 st-teacher">
                              <TooltipWrap text={`${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap>
                            </span>
                            {slot.classroom && (
                              <span className="text-xs text-gray-500">
                                {slot.classroom.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ]

              if (breakAfterSet.has(period)) {
                rows.push(
                  <tr key={`break-after-${period}`} className="bg-amber-50/50">
                    <td className="border border-gray-200 p-3 text-center font-medium text-amber-600 bg-amber-50">
                      <span className="font-bold">Break</span>
                      <div className="text-xs text-amber-500">Recess</div>
                    </td>
                    <td colSpan={5} className="border border-gray-200 p-4 text-center bg-amber-50/30">
                      <span className="text-amber-600 font-medium">Break / Recess</span>
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
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></span>
            <span>Scheduled Lesson</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gray-30 border border-gray-200 rounded"></span>
            <span>Free Period</span>
          </span>
        </div>
      </div>
    </div>
  );
}