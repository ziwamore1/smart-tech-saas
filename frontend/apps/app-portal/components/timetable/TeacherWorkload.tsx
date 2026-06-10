"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { workloadApi, timetableApi } from "@/lib/api";

interface TeacherWorkload {
  teacherId: string;
  teacher: { id: string; firstName: string; lastName: string; email: string };
  totalLessons: number;
  totalHours: number;
  classes: Array<{ classId: string; className: string; lessonsPerWeek: number }>;
  subjects: Array<{ subjectId: string; subjectName: string; lessonsPerWeek: number }>;
  avgLessonsPerDay: number;
  workloadLevel: "light" | "normal" | "heavy" | "overloaded";
  conflicts: Array<{ day: number; period: number; className: string }>;
}

interface WorkloadSuggestion {
  type: "move" | "swap" | "reduce";
  fromTeacher: string;
  toTeacher?: string;
  description: string;
  impact: "high" | "medium" | "low";
}

export function TeacherWorkloadDashboard() {
  const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"lessons" | "hours" | "name">("lessons");
  const [filterLevel, setFilterLevel] = useState<"all" | "light" | "normal" | "heavy" | "overloaded">("all");

  const { data: termData } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => { const res = await timetableApi.getCurrentTerm(); return res.data; },
  });

  const { data: workloads, isLoading } = useQuery({
    queryKey: ["workload-teachers", termData?.id],
    queryFn: async () => {
      const res = await workloadApi.getAllTeachers({ termId: termData?.id });
      return res.data || [];
    },
    enabled: !!termData?.id,
  });

  const { data: balancingSuggestions } = useQuery({
    queryKey: ["workload-balancing", termData?.id],
    queryFn: async () => {
      const res = await workloadApi.getBalancingSuggestions(termData?.id || "");
      return res.data || [];
    },
    enabled: !!termData?.id,
  });

  const { data: utilization } = useQuery({
    queryKey: ["workload-utilization", termData?.id],
    queryFn: async () => {
      const res = await workloadApi.getUtilization({ termId: termData?.id });
      return res.data;
    },
    enabled: !!termData?.id,
  });

  const sortedWorkloads = useMemo(() => {
    if (!workloads) return [];
    let filtered = [...workloads];
    if (filterLevel !== "all") {
      filtered = filtered.filter((w: TeacherWorkload) => w.workloadLevel === filterLevel);
    }
    return filtered.sort((a: TeacherWorkload, b: TeacherWorkload) => {
      switch (sortBy) {
        case "lessons": return b.totalLessons - a.totalLessons;
        case "hours": return b.totalHours - a.totalHours;
        case "name": return `${a.teacher.lastName} ${a.teacher.firstName}`.localeCompare(`${b.teacher.lastName} ${b.teacher.firstName}`);
        default: return 0;
      }
    });
  }, [workloads, sortBy, filterLevel]);

  const stats = useMemo(() => {
    if (!workloads) return { avgLessons: 0, overloaded: 0, heavy: 0, light: 0, total: 0 };
    const total = workloads.length;
    const avgLessons = workloads.reduce((sum: number, w: TeacherWorkload) => sum + w.totalLessons, 0) / total;
    return {
      avgLessons: Math.round(avgLessons),
      overloaded: workloads.filter((w: TeacherWorkload) => w.workloadLevel === "overloaded").length,
      heavy: workloads.filter((w: TeacherWorkload) => w.workloadLevel === "heavy").length,
      light: workloads.filter((w: TeacherWorkload) => w.workloadLevel === "light").length,
      total,
    };
  }, [workloads]);

  const levelColors = {
    light: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
    normal: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
    heavy: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300" },
    overloaded: { bg: "bg-red-100", text: "text-red-700", border: "border-red-300" },
  };

  const selectedWorkload = workloads?.find((w: TeacherWorkload) => w.teacherId === selectedTeacher);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold">Teacher Workload Analysis</h2>
              <p className="text-white/80">Balance teaching loads across all teachers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Total Teachers</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Avg Lessons/Week</div>
          <div className="text-3xl font-bold text-blue-600">{stats.avgLessons}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Light Load</div>
          <div className="text-3xl font-bold text-green-600">{stats.light}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Heavy/Overloaded</div>
          <div className="text-3xl font-bold text-orange-600">{stats.heavy + stats.overloaded}</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-sm text-gray-500">Conflicts</div>
          <div className="text-3xl font-bold text-red-600">
            {workloads?.reduce((sum: number, w: TeacherWorkload) => sum + (w.conflicts?.length || 0), 0) || 0}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All Levels</option>
              <option value="light">Light</option>
              <option value="normal">Normal</option>
              <option value="heavy">Heavy</option>
              <option value="overloaded">Overloaded</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="lessons">Sort by Lessons</option>
              <option value="hours">Sort by Hours</option>
              <option value="name">Sort by Name</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Light
            <span className="w-3 h-3 rounded-full bg-blue-500 ml-2"></span> Normal
            <span className="w-3 h-3 rounded-full bg-orange-500 ml-2"></span> Heavy
            <span className="w-3 h-3 rounded-full bg-red-500 ml-2"></span> Overloaded
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Teacher</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Lessons</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Hours</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Avg/Day</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Classes</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Level</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Conflicts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : sortedWorkloads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No teachers found</td></tr>
              ) : (
                sortedWorkloads.map((workload: TeacherWorkload) => (
                  <tr
                    key={workload.teacherId}
                    onClick={() => setSelectedTeacher(workload.teacherId)}
                    className={`hover:bg-gray-50 cursor-pointer transition-colors ${selectedTeacher === workload.teacherId ? "bg-teal-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {workload.teacher.firstName} {workload.teacher.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{workload.teacher.email}</div>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{workload.totalLessons}</td>
                    <td className="px-4 py-3 text-center">{workload.totalHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center">{workload.avgLessonsPerDay.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center">{workload.classes.length}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${levelColors[workload.workloadLevel].bg} ${levelColors[workload.workloadLevel].text}`}>
                        {workload.workloadLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {workload.conflicts.length > 0 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          {workload.conflicts.length}
                        </span>
                      ) : (
                        <span className="text-green-500">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedWorkload && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">
              {selectedWorkload.teacher.firstName} {selectedWorkload.teacher.lastName} - Detailed View
            </h3>
            <button onClick={() => setSelectedTeacher(null)} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Classes ({selectedWorkload.classes.length})
              </h4>
              <div className="space-y-2">
                {selectedWorkload.classes.map((cls: { className: string; lessonsPerWeek: number }, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{cls.className}</span>
                    <span className="text-sm text-gray-500">{cls.lessonsPerWeek} lessons/wk</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Subjects ({selectedWorkload.subjects.length})
              </h4>
              <div className="space-y-2">
                {selectedWorkload.subjects.map((subj: { subjectName: string; lessonsPerWeek: number }, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{subj.subjectName}</span>
                    <span className="text-sm text-gray-500">{subj.lessonsPerWeek} lessons/wk</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedWorkload.conflicts.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Conflicts ({selectedWorkload.conflicts.length})
              </h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                {selectedWorkload.conflicts.map((conflict: { day: number; period: number; className: string }, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-red-700">
                    <span>Day {conflict.day}, Period {conflict.period}</span>
                    <span>-</span>
                    <span>{conflict.className}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {balancingSuggestions && balancingSuggestions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3">
            <h3 className="font-bold flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Balancing Suggestions
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {balancingSuggestions.map((suggestion: WorkloadSuggestion, idx: number) => (
              <div key={idx} className={`p-4 rounded-lg border ${
                suggestion.impact === "high" ? "bg-green-50 border-green-200" :
                suggestion.impact === "medium" ? "bg-yellow-50 border-yellow-200" :
                "bg-gray-50 border-gray-200"
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium capitalize">{suggestion.type} suggestion</div>
                    <div className="text-sm text-gray-600 mt-1">{suggestion.description}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    suggestion.impact === "high" ? "bg-green-200 text-green-800" :
                    suggestion.impact === "medium" ? "bg-yellow-200 text-yellow-800" :
                    "bg-gray-200 text-gray-800"
                  }`}>
                    {suggestion.impact} impact
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RoomUtilizationChart() {
  const { data: utilization } = useQuery({
    queryKey: ["workload-utilization"],
    queryFn: async () => {
      const res = await workloadApi.getUtilization();
      return res.data;
    },
  });

  if (!utilization) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <h3 className="text-lg font-bold mb-4">Room Utilization</h3>
      <div className="space-y-3">
        {utilization.rooms?.map((room: any) => (
          <div key={room.roomId}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{room.roomName}</span>
              <span className="text-gray-500">{room.utilizationPercent}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  room.utilizationPercent > 80 ? "bg-green-500" :
                  room.utilizationPercent > 50 ? "bg-blue-500" :
                  room.utilizationPercent > 20 ? "bg-yellow-500" : "bg-gray-400"
                }`}
                style={{ width: `${room.utilizationPercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
