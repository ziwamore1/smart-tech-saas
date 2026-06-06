"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { homeworkApi, timetableApi, classApi } from "@/lib/api";
import { Slot } from "@/types/timetable";

interface Homework {
  id: string;
  title: string;
  description?: string;
  slotId?: string;
  slot?: Slot;
  classId: string;
  class?: { id: string; name: string };
  subjectId: string;
  subject?: { id: string; name: string };
  dueDate: string;
  maxScore?: number;
  attachments?: string[];
  createdAt: string;
  submissionsCount?: number;
}

interface Submission {
  id: string;
  homeworkId: string;
  studentId: string;
  student?: { firstName: string; lastName: string; admissionNumber: string };
  submission?: string;
  attachments?: string[];
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

interface HomeworkWithSubmission extends Homework {
  mySubmission?: Submission;
}

interface HomeworkModalProps {
  mode: "create" | "edit" | "view";
  homework?: Homework;
  classId?: string;
  slotId?: string;
  onClose: () => void;
}

export default function HomeworkModal({ mode, homework, classId, slotId, onClose }: HomeworkModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: homework?.title || "",
    description: homework?.description || "",
    classId: homework?.classId || classId || "",
    subjectId: homework?.subjectId || "",
    dueDate: homework?.dueDate?.split("T")[0] || new Date().toISOString().split("T")[0],
    maxScore: homework?.maxScore || 100,
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const res = await classApi.getAll(); return res.data; },
  });

  const { data: termData } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => { const res = await timetableApi.getCurrentTerm(); return res.data; },
  });

  const { data: subjectData } = useQuery({
    queryKey: ["class-subjects", formData.classId],
    queryFn: async () => { 
      const res = await import("@/lib/api").then(m => m.classSubjectApi.getByClass(formData.classId)); 
      return res.data; 
    },
    enabled: !!formData.classId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => homeworkApi.create({ ...data, slotId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      alert("Homework created successfully!");
      onClose();
    },
    onError: () => alert("Failed to create homework"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => homeworkApi.update(homework!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      alert("Homework updated successfully!");
      onClose();
    },
    onError: () => alert("Failed to update homework"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "create") {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {mode === "create" ? "Create Homework" : mode === "edit" ? "Edit Homework" : "View Homework"}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                placeholder="e.g., Chapter 5 Exercises"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                rows={4}
                placeholder="Instructions, resources, or notes..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class *</label>
                <select
                  required
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value, subjectId: "" })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  disabled={mode !== "create"}
                >
                  <option value="">Select Class</option>
                  {classes?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <select
                  required
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select Subject</option>
                  {subjectData?.map((s: any) => (
                    <option key={s.subjectId} value={s.subjectId}>{s.subject?.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Score</label>
                <input
                  type="number"
                  value={formData.maxScore}
                  onChange={(e) => setFormData({ ...formData, maxScore: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  min={0}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {mode === "create" ? "Create Homework" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function HomeworkList({ classId, showCreate = true }: { classId?: string; showCreate?: boolean }) {
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "overdue">("all");

  const { data: homeworkList, isLoading } = useQuery({
    queryKey: ["homework", classId],
    queryFn: async () => {
      const params: any = {};
      if (classId) params.classId = classId;
      const res = await homeworkApi.getAll(params);
      return res.data || [];
    },
  });

  const filteredHomework = homeworkList?.filter((h: Homework) => {
    const now = new Date();
    const dueDate = new Date(h.dueDate);
    const isOverdue = dueDate < now;
    const hasSubmission = h.submissionsCount && h.submissionsCount > 0;

    switch (filter) {
      case "pending": return !hasSubmission && !isOverdue;
      case "completed": return hasSubmission;
      case "overdue": return isOverdue && !hasSubmission;
      default: return true;
    }
  });

  const stats = {
    total: homeworkList?.length || 0,
    pending: homeworkList?.filter((h: Homework) => !h.submissionsCount && new Date(h.dueDate) >= new Date()).length || 0,
    completed: homeworkList?.filter((h: Homework) => h.submissionsCount).length || 0,
    overdue: homeworkList?.filter((h: Homework) => new Date(h.dueDate) < new Date() && !h.submissionsCount).length || 0,
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">Homework</h2>
              <p className="text-sm text-white/80">Assignments linked to timetable</p>
            </div>
          </div>
          {showCreate && (
            <button
              onClick={() => { setSelectedHomework(null); setShowModal(true); }}
              className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Homework
            </button>
          )}
        </div>
      </div>

      <div className="p-4 border-b bg-gray-50">
        <div className="flex flex-wrap gap-3">
          {(["all", "pending", "completed", "overdue"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1 text-xs opacity-70">
                ({f === "all" ? stats.total : f === "pending" ? stats.pending : f === "completed" ? stats.completed : stats.overdue})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading homework...</div>
        ) : filteredHomework?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            No homework found
          </div>
        ) : (
          filteredHomework?.map((homework: Homework) => {
            const dueDate = new Date(homework.dueDate);
            const isOverdue = dueDate < new Date();
            const isDueSoon = !isOverdue && (dueDate.getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000;

            return (
              <div
                key={homework.id}
                onClick={() => { setSelectedHomework(homework); setShowModal(true); }}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{homework.title}</h3>
                      {isOverdue && !homework.submissionsCount && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Overdue</span>
                      )}
                      {isDueSoon && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Due Soon</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">{homework.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        {homework.class?.name || "All Classes"}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        {homework.subject?.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Due: {dueDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-600">
                      {homework.submissionsCount || 0}
                    </div>
                    <div className="text-xs text-gray-400">submissions</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <HomeworkModal
          mode={selectedHomework ? "view" : "create"}
          homework={selectedHomework || undefined}
          classId={classId}
          onClose={() => { setShowModal(false); setSelectedHomework(null); }}
        />
      )}
    </div>
  );
}

export function HomeworkCalendar({ classId }: { classId?: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: calendarData } = useQuery({
    queryKey: ["homework-calendar", currentDate.toISOString(), classId],
    queryFn: async () => {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const res = await homeworkApi.getCalendar({
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        classId,
      });
      return res.data || [];
    },
  });

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => i);

  const homeworkByDay: Record<number, Homework[]> = {};
  calendarData?.forEach((h: Homework) => {
    const day = new Date(h.dueDate).getDate();
    if (!homeworkByDay[day]) homeworkByDay[day] = [];
    homeworkByDay[day].push(h);
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-white/20 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-bold">
          {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-white/20 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 bg-gray-50 border-b">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {blanks.map(i => <div key={`blank-${i}`} className="p-2 border-b border-r bg-gray-50" />)}
        {days.map(day => {
          const homework = homeworkByDay[day] || [];
          const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth();

          return (
            <div
              key={day}
              onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
              className={`p-2 border-b border-r min-h-[80px] cursor-pointer hover:bg-purple-50 transition-colors ${isToday ? "bg-purple-50" : ""}`}
            >
              <div className={`text-sm font-medium mb-1 ${isToday ? "text-purple-600" : ""}`}>{day}</div>
              {homework.slice(0, 2).map(h => (
                <div key={h.id} className="text-xs bg-purple-100 text-purple-700 rounded px-1 py-0.5 mb-1 truncate">
                  {h.title}
                </div>
              ))}
              {homework.length > 2 && (
                <div className="text-xs text-gray-400">+{homework.length - 2} more</div>
              )}
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <div className="p-4 bg-gray-50 border-t">
          <h4 className="font-semibold mb-2">
            Due on {selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </h4>
          {homeworkByDay[selectedDate.getDate()]?.length > 0 ? (
            <div className="space-y-2">
              {homeworkByDay[selectedDate.getDate()].map(h => (
                <div key={h.id} className="bg-white p-3 rounded-lg border flex items-center justify-between">
                  <div>
                    <div className="font-medium">{h.title}</div>
                    <div className="text-sm text-gray-500">{h.subject?.name} - {h.class?.name}</div>
                  </div>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                    {h.maxScore} pts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No homework due on this date</p>
          )}
        </div>
      )}
    </div>
  );
}
