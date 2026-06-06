"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, subjectApi, teacherApi, timetableApi, schoolApi, api } from '@/lib/api';

type Props = {
  classId: string;
  termId: string;
  onSlotChange?: (slot: { day: number; period: number; subjectId: string; teacherId: string }) => void;
};

interface LessonSlot {
  id: string;
  day: number;
  period: number;
  subjectId: string;
  teacherId: string;
  subject?: { name: string; color: string };
  teacher?: { fullName: string };
}

interface ConstraintViolation {
  type: 'error' | 'warning';
  code: string;
  message: string;
  day?: number;
  period?: number;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function InteractiveTimetableGrid({ classId, termId, onSlotChange }: Props) {
  const queryClient = useQueryClient();
  const [grid, setGrid] = useState<Map<string, LessonSlot>>(new Map());
  const [constraints, setConstraints] = useState<ConstraintViolation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ day: number; period: number } | null>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [config, setConfig] = useState({ periodsPerDay: 7, daysPerWeek: 5, breakAfterPeriod: 3 });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: timeSettings } = useQuery({
    queryKey: ['schoolTimeSettings'],
    queryFn: () => schoolApi.getTimeSettings().then(res => res.data),
  });

  const { data: timetable } = useQuery({
    queryKey: ['classTimetable', classId, termId],
    queryFn: () => timetableApi.getClassTimetable(classId, termId).then(res => res.data),
    enabled: !!classId && !!termId,
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(res => res.data),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const res = await teacherApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: schoolConstraints } = useQuery({
    queryKey: ['grid-constraints'],
    queryFn: async () => {
      try {
        const res = await api.get('/constraints/school');
        return res.data?.data || res.data;
      } catch { return null; }
    },
    retry: false,
  });

  const moveSlotMutation = useMutation({
    mutationFn: ({ slotId, day, period, subjectId, teacherId }: { slotId: string; day: number; period: number; subjectId: string; teacherId: string }) =>
      timetableApi.moveSlot(slotId, day, period),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classTimetable'] }),
  });

  useEffect(() => {
    if (timeSettings) {
      setConfig({
        periodsPerDay: timeSettings.periodsPerDay || 7,
        daysPerWeek: timeSettings.daysPerWeek || 5,
        breakAfterPeriod: timeSettings.breakAfterPeriod || 3,
      });
    }
  }, [timeSettings]);

  const maxSubjectPerDay = schoolConstraints?.maxSubjectPerDay || 2;
  const maxLessonsPerDay = schoolConstraints?.maxLessonsPerTeacherPerDay || 6;

  useEffect(() => {
    if (timetable?.slots) {
      const newGrid = new Map<string, LessonSlot>();
      timetable.slots.forEach((slot: LessonSlot) => {
        const key = `${slot.day}-${slot.period}`;
        newGrid.set(key, slot);
      });
      setGrid(newGrid);
    }
  }, [timetable]);

  const validateSlot = useCallback((key: string, lesson: LessonSlot | undefined): ConstraintViolation[] => {
    const violations: ConstraintViolation[] = [];
    const [dayStr, periodStr] = key.split('-');
    const day = parseInt(dayStr);
    const period = parseInt(periodStr);

    if (!lesson) return violations;

    const teacherSlots = Array.from(grid.entries())
      .filter(([k, v]) => k !== key && v?.teacherId === lesson.teacherId)
      .map(([k]) => {
        const [d, p] = k.split('-').map(Number);
        return { day: d, period: p };
      });

    for (const slot of teacherSlots) {
      if (slot.day === day && slot.period === period) {
        violations.push({
          type: 'error',
          code: 'TEACHER_CLASH',
          message: `Teacher already has class at this time`,
          day,
          period,
        });
      }

      if (slot.day === day && Math.abs(slot.period - period) === 1) {
        violations.push({
          type: 'warning',
          code: 'CONSECUTIVE',
          message: 'Teacher has consecutive lessons',
          day,
          period,
        });
      }

      if (slot.day === day && 
          ((period < config.breakAfterPeriod && slot.period > config.breakAfterPeriod) ||
           (period > config.breakAfterPeriod && slot.period < config.breakAfterPeriod))) {
        violations.push({
          type: 'error',
          code: 'BREAK_SPLIT',
          message: 'Teacher split by break period',
          day,
          period,
        });
      }
    }

    const classSlots = Array.from(grid.entries())
      .filter(([k, v]) => k !== key && v?.subjectId === lesson.subjectId)
      .map(([k]) => {
        const [d, p] = k.split('-').map(Number);
        return { day: d, period: p };
      });

    const sameDayCount = classSlots.filter(s => s.day === day).length;
    if (sameDayCount >= maxSubjectPerDay) {
      violations.push({
        type: 'warning',
        code: 'SAME_DAY',
        message: `Subject repeated ${sameDayCount}x same day (max: ${maxSubjectPerDay})`,
        day,
        period,
      });
    }

    if (teacherSlots.filter(s => s.day === day).length + 1 > maxLessonsPerDay) {
      violations.push({
        type: 'warning',
        code: 'MAX_LESSONS',
        message: `Teacher would have too many lessons this day (max: ${maxLessonsPerDay})`,
        day,
        period,
      });
    }

    return violations;
  }, [grid, config, maxSubjectPerDay, maxLessonsPerDay]);

  const validateAll = useCallback((): ConstraintViolation[] => {
    const allViolations: ConstraintViolation[] = [];
    grid.forEach((lesson, key) => {
      const violations = validateSlot(key, lesson);
      allViolations.push(...violations);
    });
    return allViolations;
  }, [grid, validateSlot]);

  useEffect(() => {
    const violations = validateAll();
    setConstraints(violations);
  }, [grid, validateAll]);

  const getSlotViolations = useCallback((day: number, period: number): ConstraintViolation[] => {
    const key = `${day}-${period}`;
    const lesson = grid.get(key);
    return validateSlot(key, lesson);
  }, [grid, validateSlot]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const lessonId = active.id;
    const [newDay, newPeriod] = over.id.split('-').map(Number);

    const existing = Array.from(grid.entries())
      .find(([, lesson]) => lesson?.id === lessonId);

    if (existing) {
      const oldKey = existing[0];
      const [, oldPeriod] = oldKey.split('-').map(Number);

      if (newPeriod === config.breakAfterPeriod) {
        return;
      }

      setGrid(prev => {
        const newGrid = new Map(prev);
        newGrid.delete(oldKey);
        newGrid.set(`${newDay}-${newPeriod}`, {
          ...prev.get(`${newDay}-${newPeriod}`),
          id: lessonId,
        } as LessonSlot);
        return newGrid;
      });

      onSlotChange?.({
        day: newDay,
        period: newPeriod,
        subjectId: '',
        teacherId: '',
      });
    }
  };

  const autoFixConflicts = useCallback(async () => {
    setIsAutoFixing(true);
    const violations = validateAll();

    const teacherPeriods = new Map<string, number[]>();
    const classPeriods = new Map<string, number[]>();

    for (const v of violations) {
      if (v.code === 'TEACHER_CLASH' && v.day !== undefined && v.period !== undefined) {
        const arr = teacherPeriods.get(v.code) || [];
        arr.push(v.day * 10 + v.period);
        teacherPeriods.set(v.code, arr);
      }
    }

    setTimeout(() => setIsAutoFixing(false), 500);
  }, [validateAll]);

  const renderCell = (day: number, period: number) => {
    const key = `${day}-${period}`;
    const lesson = grid.get(key);
    const violations = getSlotViolations(day, period);
    const hasError = violations.some(v => v.type === 'error');
    const hasWarning = violations.some(v => v.type === 'warning');

    return (
      <div
        key={key}
        className={`min-h-[60px] border rounded p-1 cursor-pointer transition relative ${
          lesson
            ? hasError
              ? 'bg-red-50 border-red-300'
              : hasWarning
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-white hover:bg-blue-50'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
        onClick={() => setSelectedSlot({ day, period })}
      >
        {lesson ? (
          <div className="text-[10px]">
            <div 
              className="font-medium text-[11px] truncate"
              style={{ color: lesson.subject?.color || '#333' }}
            >
              {lesson.subject?.name || 'Subject'}
            </div>
            <div className="text-gray-500 truncate">
              {lesson.teacher?.fullName || 'Teacher'}
            </div>
            {hasError && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" title={violations[0]?.message} />
            )}
            {hasWarning && !hasError && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full" title={violations[0]?.message} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300 text-xs">
            +
          </div>
        )}
      </div>
    );
  };

  const activeLesson = activeId ? grid.get(activeId) : null;

  const errors = constraints.filter(c => c.type === 'error');
  const warnings = constraints.filter(c => c.type === 'warning');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Errors ({errors.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-gray-600">Warnings ({warnings.length})</span>
          </div>
        </div>
        <button
          onClick={autoFixConflicts}
          disabled={isAutoFixing || constraints.length === 0}
          className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {isAutoFixing ? 'Fixing...' : 'Auto-Fix'}
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {(() => {
          const cols = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1).flatMap(p =>
            p === config.breakAfterPeriod
              ? [{ type: 'period' as const, period: p }, { type: 'break' as const }]
              : [{ type: 'period' as const, period: p }]
          )
          return (
            <div className="grid" style={{ gridTemplateColumns: `50px repeat(${cols.length}, 1fr)` }}>
              {/* Header */}
              <div className="bg-gray-100 p-2 text-center font-medium text-xs">Day</div>
              {cols.map((col, idx) => {
                if (col.type === 'break') {
                  return (
                    <div key={`break-h-${idx}`} className="bg-amber-50 p-2 text-center font-medium text-xs text-amber-600">
                      Break
                    </div>
                  )
                }
                return (
                  <div key={`h-${col.period}`} className="bg-gray-100 p-2 text-center font-medium text-xs">
                    P{col.period}
                  </div>
                )
              })}

              {/* Rows */}
              {DAYS.slice(0, config.daysPerWeek).flatMap((day, dayIdx) => [
                <div key={`label-${day}`} className="bg-gray-100 p-2 font-medium text-xs">
                  {day}
                </div>,
                ...cols.map((col, idx) => {
                  if (col.type === 'break') {
                    return (
                      <div key={`break-${dayIdx}-${idx}`} className="min-h-[60px] border rounded bg-amber-50 flex items-center justify-center">
                        <span className="text-amber-400 text-xs font-medium">BREAK</span>
                      </div>
                    )
                  }
                  return renderCell(dayIdx + 1, col.period)
                })
              ])}
            </div>
          )
        })()}
      </div>

      {/* Conflict Details */}
      {constraints.length > 0 && (
        <div className="bg-white rounded-lg border p-3">
          <h4 className="font-medium mb-2">Constraint Violations</h4>
          <div className="space-y-1">
            {constraints.slice(0, 5).map((c, i) => (
              <div
                key={i}
                className={`text-sm p-2 rounded ${
                  c.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                {c.code}: {c.message}
                {c.day && c.period && ` (${DAYS[c.day - 1]} P${c.period})`}
              </div>
            ))}
            {constraints.length > 5 && (
              <div className="text-sm text-gray-500">
                +{constraints.length - 5} more violations
              </div>
            )}
          </div>
        </div>
      )}

      <DragOverlay>
        {activeLesson ? (
          <div className="bg-white border rounded p-2 shadow-lg">
            <div className="text-sm font-medium">
              {activeLesson.subject?.name}
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Slot Edit Modal */}
      {selectedSlot && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedSlot(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 w-96"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              Edit Slot: {DAYS[selectedSlot.day - 1]} Period {selectedSlot.period}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Subject</label>
                <select className="w-full border rounded-lg px-3 py-2 mt-1">
                  <option value="">Select Subject</option>
                  {subjects?.data?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">Teacher</label>
                <select className="w-full border rounded-lg px-3 py-2 mt-1">
                  <option value="">Select Teacher</option>
                  {teachers?.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setSelectedSlot(null);
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}