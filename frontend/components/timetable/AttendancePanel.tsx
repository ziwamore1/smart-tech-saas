"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi, studentApi, timetableApi } from "@/lib/api";
import { Slot } from "@/types/timetable";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface AttendanceRecord {
  id: string;
  studentId: string;
  student?: { firstName: string; lastName: string; admissionNumber: string };
  slotId?: string;
  date: string;
  status: AttendanceStatus;
  remarks?: string;
  createdAt: string;
}

interface SlotWithAttendance extends Slot {
  attendance?: AttendanceRecord[];
}

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string; bg: string; icon: string }> = {
  present: { label: "Present", color: "text-green-700", bg: "bg-green-100", icon: "✓" },
  absent: { label: "Absent", color: "text-red-700", bg: "bg-red-100", icon: "✗" },
  late: { label: "Late", color: "text-yellow-700", bg: "bg-yellow-100", icon: "◐" },
  excused: { label: "Excused", color: "text-blue-700", bg: "bg-blue-100", icon: "○" },
};

interface AttendancePanelProps {
  slot?: Slot;
  classId: string;
  date: Date;
  onClose?: () => void;
}

export default function AttendancePanel({ slot, classId, date, onClose }: AttendancePanelProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(date);
  const [selectedSlot, setSelectedSlot] = useState<Slot | undefined>(slot);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const dateStr = useMemo(() => {
    return selectedDate.toISOString().split("T")[0];
  }, [selectedDate]);

  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ["class-students", classId],
    queryFn: async () => {
      const res = await studentApi.getAll({ classId });
      return res.data;
    },
    enabled: !!classId,
  });

  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: ["attendance", classId, dateStr, selectedSlot?.id],
    queryFn: async () => {
      const params: any = { date: dateStr };
      if (selectedSlot?.id) params.slotId = selectedSlot.id;
      const res = await attendanceApi.getByClass(classId, dateStr);
      return res.data || [];
    },
    enabled: !!classId && !!dateStr,
  });

  const { data: termData } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => { const res = await timetableApi.getCurrentTerm(); return res.data; },
  });

  const { data: classTimetable } = useQuery({
    queryKey: ["class-timetable-attendance", classId, termData?.id],
    queryFn: async () => { const res = await timetableApi.getClassTimetable(classId, termData?.id || ""); return res.data; },
    enabled: !!classId && !!termData?.id,
  });

  const dayOfWeek = selectedDate.getDay();
  const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const slotsForDay = useMemo(() => {
    if (!classTimetable?.slots) return [];
    return classTimetable.slots.filter((s: Slot) => s.day === dayIndex + 1);
  }, [classTimetable, dayIndex]);

  useEffect(() => {
    if (attendanceData) {
      const map: Record<string, AttendanceStatus> = {};
      const remarks: Record<string, string> = {};
      attendanceData.forEach((record: AttendanceRecord) => {
        map[record.studentId] = record.status;
        if (record.remarks) remarks[record.studentId] = record.remarks;
      });
      setAttendanceMap(map);
      setRemarksMap(remarks);
    }
  }, [attendanceData]);

  const createBulkAttendance = useMutation({
    mutationFn: (records: Array<{ studentId: string; status: AttendanceStatus; remarks?: string }>) =>
      attendanceApi.createByClass({
        classId,
        slotId: selectedSlot?.id,
        date: dateStr,
        records,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      showNotification("Attendance saved successfully!", "success");
    },
    onError: () => {
      showNotification("Failed to save attendance", "error");
    },
  });

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  };

  const handleBulkStatus = (status: AttendanceStatus) => {
    const newMap = { ...attendanceMap };
    selectedStudents.forEach(id => {
      newMap[id] = status;
    });
    setAttendanceMap(newMap);
    setSelectedStudents(new Set());
    setShowBulkActions(false);
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === studentsData?.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(studentsData?.map((s: any) => s.id) || []));
    }
  };

  const handleSave = () => {
    const records = Object.entries(attendanceMap).map(([studentId, status]) => ({
      studentId,
      status,
      remarks: remarksMap[studentId] || undefined,
    }));
    createBulkAttendance.mutate(records);
  };

  const showNotification = (message: string, type: "success" | "error" | "info") => {
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  const stats = useMemo(() => {
    const total = Object.keys(attendanceMap).length || studentsData?.length || 0;
    const present = Object.values(attendanceMap).filter(s => s === "present").length;
    const absent = Object.values(attendanceMap).filter(s => s === "absent").length;
    const late = Object.values(attendanceMap).filter(s => s === "late").length;
    const excused = Object.values(attendanceMap).filter(s => s === "excused").length;
    const marked = Object.keys(attendanceMap).length;
    return { total, present, absent, late, excused, marked, unmarked: total - marked };
  }, [attendanceMap, studentsData]);

  const isAllMarked = stats.marked === stats.total && stats.total > 0;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Attendance Register</h2>
              <p className="text-sm text-white/80">
                {selectedDate.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setSelectedDate(new Date(e.target.value + "T00:00:00"))}
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Period / Subject</label>
            <select
              value={selectedSlot?.id || ""}
              onChange={(e) => {
                const slot = slotsForDay.find((s: Slot) => s.id === e.target.value);
                setSelectedSlot(slot);
              }}
              className="border rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">Select Period (optional)</option>
              {slotsForDay.map((s: Slot, idx: number) => (
                <option key={s.id || idx} value={s.id}>
                  Period {s.period}: {s.subject?.name} ({(s.teacher?.user as any)?.firstName || (s.teacher?.user as any)?.username || "Teacher"} {(s.teacher?.user as any)?.lastName || ""})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
            <div className="text-xs text-green-700">Present</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
            <div className="text-xs text-red-700">Absent</div>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
            <div className="text-xs text-yellow-700">Late</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.excused}</div>
            <div className="text-xs text-blue-700">Excused</div>
          </div>
          <div className="bg-gray-100 rounded-lg p-3 text-center border border-gray-200">
            <div className="text-2xl font-bold text-gray-600">{stats.marked}</div>
            <div className="text-xs text-gray-700">Marked</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
            <div className="text-2xl font-bold text-orange-600">{stats.unmarked}</div>
            <div className="text-xs text-orange-700">Unmarked</div>
          </div>
        </div>

        {selectedStudents.size > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-orange-50 p-2 rounded-lg">
            <span className="text-sm text-orange-700">{selectedStudents.size} selected</span>
            <div className="flex gap-2 ml-auto">
              {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map(status => (
                <button
                  key={status}
                  onClick={() => handleBulkStatus(status)}
                  className={`px-3 py-1 text-xs rounded-full ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].color} font-medium`}
                >
                  Mark {STATUS_CONFIG[status].label}
                </button>
              ))}
              <button onClick={() => setSelectedStudents(new Set())} className="px-3 py-1 text-xs rounded-full bg-gray-200 text-gray-700">
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {loadingStudents || loadingAttendance ? (
          <div className="p-8 text-center text-gray-500">Loading students...</div>
        ) : studentsData?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No students in this class</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStudents.size === studentsData?.length}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Student</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Status</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {studentsData?.map((student: any, idx: number) => {
                const status = attendanceMap[student.id];
                const isSelected = selectedStudents.has(student.id);
                return (
                  <tr
                    key={student.id}
                    className={`border-t border-gray-100 ${isSelected ? "bg-orange-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedStudents);
                          if (e.target.checked) newSet.add(student.id);
                          else newSet.delete(student.id);
                          setSelectedStudents(newSet);
                        }}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-gray-900">{student.firstName || student.user?.firstName || "Unknown"} {student.lastName || student.user?.lastName || ""}</div>
                      <div className="text-xs text-gray-500">{student.admissionNumber || student.user?.username || ""}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center gap-1">
                        {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map(s => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(student.id, s)}
                            className={`w-10 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
                              status === s
                                ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} border-2 border-current`
                                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                            }`}
                            title={STATUS_CONFIG[s].label}
                          >
                            {STATUS_CONFIG[s].icon}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        placeholder="Add remarks..."
                        value={remarksMap[student.id] || ""}
                        onChange={(e) => setRemarksMap(prev => ({ ...prev, [student.id]: e.target.value }))}
                        className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {isAllMarked ? (
            <span className="text-green-600 font-medium flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              All students marked
            </span>
          ) : (
            <span>{stats.unmarked} students unmarked</span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setAttendanceMap({})}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={createBulkAttendance.isPending}
            className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            {createBulkAttendance.isPending ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AttendanceStatsProps {
  classId: string;
  startDate?: string;
  endDate?: string;
}

export function AttendanceStats({ classId, startDate, endDate }: AttendanceStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["attendance-stats", classId, startDate, endDate],
    queryFn: async () => {
      const res = await attendanceApi.getStats({ classId, startDate, endDate });
      return res.data;
    },
    enabled: !!classId,
  });

  if (isLoading) return <div className="animate-pulse bg-gray-200 h-40 rounded-lg" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="text-sm text-gray-500 mb-1">Attendance Rate</div>
        <div className="text-3xl font-bold text-green-600">{stats?.attendanceRate || 0}%</div>
        <div className="text-xs text-gray-400 mt-1">Last 30 days</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="text-sm text-gray-500 mb-1">Total Present</div>
        <div className="text-3xl font-bold text-blue-600">{stats?.totalPresent || 0}</div>
        <div className="text-xs text-gray-400 mt-1">Students</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="text-sm text-gray-500 mb-1">Total Absent</div>
        <div className="text-3xl font-bold text-red-600">{stats?.totalAbsent || 0}</div>
        <div className="text-xs text-gray-400 mt-1">Students</div>
      </div>
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="text-sm text-gray-500 mb-1">Late Arrivals</div>
        <div className="text-3xl font-bold text-yellow-600">{stats?.totalLate || 0}</div>
        <div className="text-xs text-gray-400 mt-1">Students</div>
      </div>
    </div>
  );
}
