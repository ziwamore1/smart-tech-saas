"use client";

import { useQuery } from "@tanstack/react-query";
import { timetableApi } from "@/lib/api";
import { useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PERIODS = Array.from({ length: 8 }, (_, i) => i + 1);

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

interface ChildTimetable {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  class: {
    id: string;
    name: string;
  } | null;
  slots: Slot[];
}

export default function ParentTimetable({ termId }: { termId?: string }) {
  const [selectedTerm, setSelectedTerm] = useState(termId || "");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const { data: childrenData, isLoading: isLoadingChildren } = useQuery<ChildTimetable[]>({
    queryKey: ["childrenTimetables", selectedTerm],
    queryFn: async () => {
      const res = await timetableApi.getChildrenTimetables(selectedTerm || undefined);
      return res.data;
    },
  });

  const selectedChild = selectedChildId 
    ? childrenData?.find(c => c.student.id === selectedChildId) 
    : childrenData?.[0];

  const getSlot = (day: number, period: number): Slot | undefined => {
    if (!selectedChild?.slots) return undefined;
    return selectedChild.slots.find((s) => s.day === day && s.period === period);
  };

  if (isLoadingChildren) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading your children&apos;s timetables...</span>
      </div>
    );
  }

  if (!childrenData || childrenData.length === 0) {
    return (
      <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600 text-lg">No children found linked to your account.</p>
        <p className="text-gray-500 text-sm mt-2">Please contact the school to link your children.</p>
      </div>
    );
  }

  // Auto-select first child if none selected
  if (!selectedChildId && childrenData.length > 0) {
    setSelectedChildId(childrenData[0].student.id);
  }

  return (
    <div className="space-y-6">
      {/* Child Selector */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Child</h3>
        <div className="flex flex-wrap gap-2">
          {childrenData.map((child) => (
            <button
              key={child.student.id}
              onClick={() => setSelectedChildId(child.student.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedChildId === child.student.id || (!selectedChildId && childrenData[0]?.student.id === child.student.id)
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {child.student.firstName} {child.student.lastName}
              {child.class && <span className="ml-1 opacity-75">({child.class.name})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Child Timetable */}
      {selectedChild && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedChild.student.firstName} {selectedChild.student.lastName}
                </h2>
                <p className="text-green-100 text-sm">
                  Class: {selectedChild.class?.name || "Not assigned"} | 
                  Admission: {selectedChild.student.admissionNumber}
                </p>
              </div>
              {selectedTerm && (
                <div className="text-sm bg-green-800 px-3 py-1 rounded">
                  Term ID: {selectedTerm.slice(0, 8)}...
                </div>
              )}
            </div>
          </div>

          {/* Timetable Grid */}
          {selectedChild.slots.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No timetable available for this child in this term.
            </div>
          ) : (
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
                  {PERIODS.map((period) => (
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
                              slot ? "bg-green-50" : "bg-gray-30"
                            }`}
                          >
                            {slot ? (
                              <div className="flex flex-col">
                                <span className="font-semibold text-green-800 text-sm">
                                  {slot.subject.name}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {slot.teacher.user.firstName} {slot.teacher.user.lastName}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legend */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 bg-green-50 border border-green-200 rounded"></span>
                <span>Scheduled Lesson</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 bg-gray-30 border border-gray-200 rounded"></span>
                <span>Free Period</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}