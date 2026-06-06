"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useMemo, useRef } from "react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, useDraggable, useDroppable, DragOverlay } from "@dnd-kit/core";
import type { Class, ClassMatrix, Slot } from "@/types/timetable";
import { dayLabels, getSubjectColor } from "@/config/subjectColors";
import { classApi, timetableApi, schoolApi } from "@/lib/api";
import type { TimeSettings } from "@/lib/computePeriodTimes";
import { computePeriodTimes, computeBreakPeriods, getPeriodsPerDay } from "@/lib/computePeriodTimes";
import TimetableEditorModal from "./TimetableEditorModal";
import TooltipWrap from "./TooltipWrap";
import UnplacedLessonsPanel from "./UnplacedLessonsPanel";
import { abbreviateSubject, abbreviateClassName, abbreviateTeacher } from "@/lib/abbreviations";

function DraggableSubject({ subject, onRemove }: { subject: any; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${subject.id}`,
    data: { subject, type: "palette" },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`text-[10px] leading-tight cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="font-medium truncate">{subject.name}</div>
      {onRemove && (
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="text-[8px] text-red-500 hover:text-red-700"
        >×</button>
      )}
    </div>
  );
}

function getTeacherFullName(t: any): string {
  if (!t) return "";
  const fn = t.user?.firstName || t.firstName || "";
  const ln = t.user?.lastName || t.lastName || "";
  if (fn && ln) return `${fn} ${ln}`;
  return fn || ln || "";
}

function DraggableSlotContent({ slot, isDragging, hideSubject }: { slot: Slot; isDragging?: boolean; hideSubject?: boolean }) {
  const subjShort = abbreviateSubject(slot.subject?.name);
  const colorConfig = slot.subject?.name ? getSubjectColor(slot.subject.name) : null;
  const teacherName = abbreviateTeacher(slot.teacher);
  const teacherFull = getTeacherFullName(slot.teacher);
  const roomName = slot.classroom?.name || slot.room?.name || '';

  return (
    <div className={`flex flex-col items-center justify-center h-full ${isDragging ? 'opacity-0' : ''}`}>
      {!hideSubject && (
        <TooltipWrap text={slot.subject?.name || ''}>
          <span className={`font-bold text-[10px] leading-tight truncate w-full text-center px-0.5 ${colorConfig?.text || 'text-slate-800'}`}>
            {subjShort}
          </span>
        </TooltipWrap>
      )}
      {teacherName && (
        <TooltipWrap text={teacherFull}>
          <span className="text-[8px] text-slate-500 truncate w-full text-center leading-tight">
            {teacherName}
          </span>
        </TooltipWrap>
      )}
      {roomName && (
        <span className="text-[8px] text-slate-400 truncate w-full text-center leading-tight">
          {roomName}
        </span>
      )}
    </div>
  );
}

function MergedPeriodCell({
  slot, day, period, classId, colSpan, onSlotClick, onSlotDoubleClick, isPrintMode, isDragOver, isConflict
}: {
  slot: Slot;
  day: number;
  period: number;
  classId: string;
  colSpan: number;
  onSlotClick?: (slot: Slot | null) => void;
  onSlotDoubleClick?: (slot: Slot) => void;
  isPrintMode?: boolean;
  isDragOver?: boolean;
  isConflict?: boolean;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${classId}-${day}-${period}`,
    data: { classId, day, period, slot },
  });

  const canDrag = !isPrintMode;
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: slot.id || `${classId}-${day}-${period}`,
    disabled: !canDrag,
    data: { slot, classId, day, period, sourceClassId: classId, type: "slot" },
  });

  const colorConfig = slot.subject?.name ? getSubjectColor(slot.subject.name) : null;
  const bgStyle: React.CSSProperties = {};
  if (colorConfig) {
    const clsMap: Record<string, string> = {
      'bg-amber-200': '#fef3c7', 'bg-blue-200': '#dbeafe', 'bg-green-200': '#dcfce7',
      'bg-pink-200': '#fce7f3', 'bg-indigo-200': '#e0e7ff', 'bg-violet-200': '#ede9fe',
      'bg-teal-200': '#ccfbf1', 'bg-orange-200': '#ffedd5', 'bg-rose-200': '#ffe4e6',
      'bg-sky-200': '#e0f2fe', 'bg-red-200': '#fee2e2', 'bg-fuchsia-200': '#fae8ff',
      'bg-purple-200': '#f3e8ff', 'bg-lime-200': '#ecfccb', 'bg-slate-200': '#f1f5f9',
      'bg-stone-200': '#f5f5f4', 'bg-cyan-200': '#cffafe', 'bg-yellow-200': '#fef9c3',
    };
    const match = colorConfig.bg.match(/bg-([a-z]+)-200/);
    if (match && clsMap[`bg-${match[1]}-200`]) {
      bgStyle.backgroundColor = clsMap[`bg-${match[1]}-200`];
    }
  }

  const showOverlay = isDragOver || isOver;
  const subjShort = abbreviateSubject(slot.subject?.name);
  const teacherName = abbreviateTeacher(slot.teacher);
  const teacherFull = getTeacherFullName(slot.teacher);
  const roomName = slot.classroom?.name || slot.room?.name || '';

  const handleClick = () => {
    if (!isPrintMode) onSlotClick?.(slot);
  };

  return (
    <td
      ref={(node) => {
        (setDropRef as any)(node);
        if (canDrag) (setDragRef as any)(node);
      }}
      onClick={handleClick}
      onDoubleClick={() => { if (!isPrintMode && slot) onSlotDoubleClick?.(slot); }}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      colSpan={colSpan}
      className={`
        p-0 border-b border-r text-center text-xs transition-all select-none
        ${showOverlay && !isPrintMode ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/60' : ''}
        ${isConflict && showOverlay && !isPrintMode ? 'ring-2 ring-inset ring-red-400 bg-red-50/60' : ''}
        ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${isDragging ? 'opacity-30' : ''}
      `}
      style={{
        ...bgStyle,
        minHeight: '44px',
        maxHeight: '52px',
      }}
    >
      <div className={`flex flex-col items-center justify-center h-full ${isDragging ? 'opacity-0' : ''}`}>
        <TooltipWrap text={slot.subject?.name || ''}>
          <span className={`font-bold text-[10px] leading-tight truncate w-full text-center px-0.5 ${colorConfig?.text || 'text-slate-800'}`}>
            {subjShort}
          </span>
        </TooltipWrap>
        {teacherName && (
          <TooltipWrap text={teacherFull}>
            <span className="text-[8px] text-slate-500 truncate w-full text-center leading-tight">{teacherName}</span>
          </TooltipWrap>
        )}
        {roomName && (
          <span className="text-[8px] text-slate-400 truncate w-full text-center leading-tight">{roomName}</span>
        )}
        <span className="text-[7px] text-slate-400 mt-0.5">{colSpan} periods</span>
      </div>
    </td>
  );
}

function TimetableCell({
  slot, day, period, classId, onSlotClick, onSlotDoubleClick, isPrintMode, isDragOver, isConflict,
}: {
  slot?: Slot;
  day: number;
  period: number;
  classId: string;
  onSlotClick?: (slot: Slot | null) => void;
  onSlotDoubleClick?: (slot: Slot) => void;
  isPrintMode?: boolean;
  isDragOver?: boolean;
  isConflict?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${classId}-${day}-${period}`,
    data: { classId, day, period, slot },
  });

  const canDrag = !!slot && !isPrintMode;
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: slot?.id || `${classId}-${day}-${period}`,
    disabled: !canDrag,
    data: { slot, classId, day, period, sourceClassId: classId, type: "slot" },
  });

  const colorConfig = slot?.subject?.name ? getSubjectColor(slot.subject.name) : null;
  const bgStyle: React.CSSProperties = {};
  if (colorConfig) {
    const clsMap: Record<string, string> = {
      'bg-amber-200': '#fef3c7', 'bg-blue-200': '#dbeafe', 'bg-green-200': '#dcfce7',
      'bg-pink-200': '#fce7f3', 'bg-indigo-200': '#e0e7ff', 'bg-violet-200': '#ede9fe',
      'bg-teal-200': '#ccfbf1', 'bg-orange-200': '#ffedd5', 'bg-rose-200': '#ffe4e6',
      'bg-sky-200': '#e0f2fe', 'bg-red-200': '#fee2e2', 'bg-fuchsia-200': '#fae8ff',
      'bg-purple-200': '#f3e8ff', 'bg-lime-200': '#ecfccb', 'bg-slate-200': '#f1f5f9',
      'bg-stone-200': '#f5f5f4', 'bg-cyan-200': '#cffafe', 'bg-yellow-200': '#fef9c3',
    };
    const match = colorConfig.bg.match(/bg-([a-z]+)-200/);
    if (match && clsMap[`bg-${match[1]}-200`]) {
      bgStyle.backgroundColor = clsMap[`bg-${match[1]}-200`];
    }
  }

  const handleClick = () => {
    if (!isPrintMode) onSlotClick?.(slot || null);
  };

  const handleDoubleClick = () => {
    if (!isPrintMode && slot) onSlotDoubleClick?.(slot);
  };

  const showOverlay = isDragOver || isOver;

  return (
    <td
      ref={(node) => {
        (setNodeRef as any)(node);
        if (canDrag) (setDragRef as any)(node);
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      className={`
        p-0 border-b border-r text-center text-xs transition-all select-none
        ${showOverlay && !isPrintMode ? 'ring-2 ring-inset ring-blue-400 bg-blue-50/60' : ''}
        ${isConflict && showOverlay && !isPrintMode ? 'ring-2 ring-inset ring-red-400 bg-red-50/60' : ''}
        ${!slot && !isPrintMode ? 'hover:bg-blue-50/40 cursor-pointer' : ''}
        ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${isDragging ? 'opacity-30' : ''}
      `}
      style={{
        ...bgStyle,
        minHeight: '44px',
        maxHeight: '52px',
      }}
    >
      {slot ? (
        <DraggableSlotContent slot={slot} isDragging={isDragging} />
      ) : !isPrintMode ? (
        <span className="text-slate-300 text-[10px]">+</span>
      ) : null}
    </td>
  );
}

function UnplacedDragOverlayContent({ subjectName, teacherName }: { subjectName: string; teacherName: string }) {
  const colorConfig = getSubjectColor(subjectName);
  return (
    <div className="rounded-lg shadow-2xl border-2 border-amber-400 bg-white px-3 py-2 min-w-[120px]">
      <div className={`font-bold text-xs ${colorConfig?.text || 'text-slate-800'}`}>
        {abbreviateSubject(subjectName)}
      </div>
      {teacherName && (
        <div className="text-[10px] text-slate-500 truncate">{teacherName}</div>
      )}
      <div className="text-[9px] text-amber-500 font-medium mt-0.5">+ New Slot</div>
    </div>
  );
}

function DragOverlayContent({ slot }: { slot: Slot }) {
  const subjShort = abbreviateSubject(slot.subject?.name);
  const colorConfig = slot.subject?.name ? getSubjectColor(slot.subject.name) : null;
  return (
    <div
      className="rounded-lg shadow-2xl border-2 border-blue-400 bg-white px-3 py-2 min-w-[120px]"
    >
      <div className={`font-bold text-xs ${colorConfig?.text || 'text-slate-800'}`}>
        {subjShort}
      </div>
      <div className="text-[10px] text-slate-500" title={getTeacherFullName(slot.teacher)}>{abbreviateTeacher(slot.teacher)}</div>
      {slot.classGroup?.name && (
        <div className="text-[10px] text-slate-400">{abbreviateClassName(slot.classGroup.name)}</div>
      )}
    </div>
  );
}

export default function MasterTimetableMatrix({
  schoolId,
  termId
}: {
  schoolId: string;
  termId: string;
}) {
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [isPrintMode, setIsPrintMode] = useState<boolean>(false);
  const [activeDragSlot, setActiveDragSlot] = useState<Slot | null>(null);
  const [activeDragSource, setActiveDragSource] = useState<{ classId: string; day: number; period: number } | null>(null);
  const [conflictCells, setConflictCells] = useState<Set<string>>(new Set());
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [editMode, setEditMode] = useState<'add' | 'edit'>('add');
  const [editClassId, setEditClassId] = useState<string>('');
  const [editDay, setEditDay] = useState<number>(1);
  const [editPeriod, setEditPeriod] = useState<number>(1);
  const [showUnplacedPanel, setShowUnplacedPanel] = useState(true);
  const [activeUnplacedDrag, setActiveUnplacedDrag] = useState<{
    subjectName: string;
    teacherName: string;
    className: string;
  } | null>(null);
  const [unplacedPrefill, setUnplacedPrefill] = useState<{
    classId: string;
    subjectId: string;
    teacherId: string;
    day: number;
    period: number;
  } | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error'; key: number } | null>(null);
  const notifKey = useRef(0);
  const queryClient = useQueryClient();

  const showNotification = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    notifKey.current++;
    setNotification({ message, type, key: notifKey.current });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const { data: timeSettings } = useQuery({
    queryKey: ["mt-time-settings", schoolId],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      return (res.data?.data || res.data) as Partial<TimeSettings>;
    },
    enabled: !!schoolId,
  });

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
  const weekdays = useMemo(() => dayLabels.filter(d => d.id <= 5), []);

  const visualColumns = useMemo(
    () =>
      periods.flatMap((p) =>
        breakPeriods.has(p)
          ? [{ type: "period" as const, period: p }, { type: "break" as const }]
          : [{ type: "period" as const, period: p }]
      ),
    [periods, breakPeriods]
  );

  const { data: classesData, isLoading: loadingClasses } = useQuery<Class[]>({
    queryKey: ["classes", schoolId],
    queryFn: async () => {
      const res = await classApi.getAll();
      return res.data?.data || res.data || [];
    },
    enabled: !!schoolId,
  });

  const classes = classesData || [];

  const { data: matrix = {}, isLoading: loadingMatrix } = useQuery<ClassMatrix>({
    queryKey: ["masterTimetable", schoolId, termId],
    queryFn: async () => {
      const result: ClassMatrix = {};
      const classesRes = await classApi.getAll();
      const classesList = classesRes.data?.data || classesRes.data || [];

      if (classesList.length === 0) return result;

      for (const cls of classesList) {
        const res = await timetableApi.getClassTimetable(cls.id, termId);
        const slots: Slot[] = res.data?.data?.slots || res.data?.slots || [];
        result[cls.id] = {};
        for (const slot of slots) {
          if (!result[cls.id][slot.day]) result[cls.id][slot.day] = {};
          result[cls.id][slot.day][slot.period] = slot;
        }
      }
      return result;
    },
    enabled: !!termId && classes.length > 0,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ slotId, targetDay, targetPeriod }: { slotId: string; targetDay: number; targetPeriod: number }) => {
      return timetableApi.moveSlot(slotId, targetDay, targetPeriod);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterTimetable", schoolId, termId] });
      showNotification('Slot moved successfully');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.message || 'Failed to move slot', 'error');
    },
  });

  const swapMutation = useMutation({
    mutationFn: async ({ sourceSlotId, targetDay, targetPeriod }: { sourceSlotId: string; targetDay: number; targetPeriod: number }) => {
      return timetableApi.swapSlot(sourceSlotId, targetDay, targetPeriod);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masterTimetable", schoolId, termId] });
      showNotification('Slots swapped successfully');
    },
    onError: (err: any) => {
      showNotification(err?.response?.data?.message || 'Failed to swap slots', 'error');
    },
  });

  const checkConflicts = useCallback((dragSlot: Slot, targetClassId: string, targetDay: number, targetPeriod: number): boolean => {
    const lessonSize = (dragSlot as any).lessonSize || 1;
    const tId = dragSlot.teacher?.id;

    for (let p = targetPeriod; p < targetPeriod + lessonSize; p++) {
      const targetSlot = matrix[targetClassId]?.[targetDay]?.[p];
      if (targetSlot) return true;

      if (tId) {
        for (const [cid, days] of Object.entries(matrix)) {
          if (cid === targetClassId) continue;
          const existing = days?.[targetDay]?.[p];
          if (existing && existing.teacher?.id === tId) {
            return true;
          }
        }
      }
    }
    return false;
  }, [matrix]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "slot" && data?.slot) {
      setActiveDragSlot(data.slot);
      setActiveDragSource({ classId: data.sourceClassId, day: data.day, period: data.period });
      setActiveUnplacedDrag(null);
    } else if (data?.type === "unplaced-lesson") {
      setActiveUnplacedDrag({
        subjectName: data.subjectName || '',
        teacherName: data.teacherName || '',
        className: '',
      });
      setActiveDragSlot(null);
    }
    setConflictCells(new Set());
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragSlot(null);
    setActiveDragSource(null);
    setActiveUnplacedDrag(null);
    setConflictCells(new Set());

    if (!active || !over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!overData) return;

    if (activeData?.type === "unplaced-lesson") {
      const targetClassId = overData.classId;
      const targetDay = overData.day;
      const targetPeriod = overData.period;
      if (!targetClassId || !targetDay || !targetPeriod) return;

      setEditClassId(targetClassId);
      setEditDay(targetDay);
      setEditPeriod(targetPeriod);
      setUnplacedPrefill({
        classId: targetClassId,
        subjectId: activeData.subjectId || '',
        teacherId: activeData.teacherId || '',
        day: targetDay,
        period: targetPeriod,
      });
      setEditSlot(null);
      setEditMode('add');
      setEditModalOpen(true);
      return;
    }

    if (activeData?.type !== "slot" || !activeData?.slot) return;

    const dragSlot: Slot = activeData.slot;
    const targetClassId = overData.classId;
    const targetDay = overData.day;
    const targetPeriod = overData.period;

    const sourceClassId = activeData.sourceClassId || activeData.classId;
    const draggedFromSameCell = sourceClassId === targetClassId && dragSlot.day === targetDay && dragSlot.period === targetPeriod;
    if (draggedFromSameCell) return;

    const targetSlot = matrix[targetClassId]?.[targetDay]?.[targetPeriod];

    if (targetSlot) {
      swapMutation.mutate({
        sourceSlotId: dragSlot.id!,
        targetDay,
        targetPeriod,
      });
    } else {
      moveMutation.mutate({
        slotId: dragSlot.id!,
        targetDay,
        targetPeriod,
      });
    }
  }, [matrix, moveMutation, swapMutation]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!active || !over || !activeDragSlot) {
      setConflictCells(new Set());
      return;
    }
    const overData = over.data.current;
    if (!overData) return;

    const conflicts = new Set<string>();
    if (activeDragSlot && overData.classId && overData.day && overData.period) {
      const hasConflict = checkConflicts(activeDragSlot, overData.classId, overData.day, overData.period);
      if (hasConflict) {
        conflicts.add(`${overData.classId}-${overData.day}-${overData.period}`);
      }
    }
    setConflictCells(conflicts);
  }, [activeDragSlot, checkConflicts]);

  const handleSlotClick = useCallback((slot: Slot | null, classId: string, day: number, period: number) => {
    if (isPrintMode) return;
    setEditClassId(classId);
    setEditDay(day);
    setEditPeriod(period);
    if (slot) {
      setEditSlot(slot);
      setEditMode('edit');
    } else {
      setEditSlot(null);
      setEditMode('add');
    }
    setEditModalOpen(true);
  }, [isPrintMode]);

  const handleSlotDoubleClick = useCallback((slot: Slot) => {
    if (isPrintMode) return;
    setEditSlot(slot);
    setEditMode('edit');
    setEditClassId(slot.classGroup?.id || '');
    setEditDay(slot.day);
    setEditPeriod(slot.period);
    setEditModalOpen(true);
  }, [isPrintMode]);

  const handleEditModalClose = useCallback(() => {
    setEditModalOpen(false);
    setEditSlot(null);
    setUnplacedPrefill(null);
    queryClient.invalidateQueries({ queryKey: ["masterTimetable", schoolId, termId] });
  }, [queryClient, schoolId, termId]);

  const buildCellKey = (clsId: string, dayId: number, period: number) => `${clsId}-${dayId}-${period}`;

  const mergedCells = useMemo(() => {
    const map = new Map<string, { colSpan: number; isStart: boolean; lessonSize: number }>();
    for (const [clsId, days] of Object.entries(matrix)) {
      for (const [dayStr, periods] of Object.entries(days)) {
        const day = Number(dayStr);
        const periodNums = Object.keys(periods).map(Number).sort((a, b) => a - b);
        for (const period of periodNums) {
          if (breakPeriods.has(period)) continue;
          const slot: any = periods[period];
          const lessonSize = slot?.lessonSize || 1;
          if (lessonSize > 1) {
            const key = buildCellKey(clsId, day, period);
            map.set(key, { colSpan: lessonSize, isStart: true, lessonSize });
            for (let p = period + 1; p < period + lessonSize; p++) {
              map.set(buildCellKey(clsId, day, p), { colSpan: 0, isStart: false, lessonSize: 0 });
            }
          }
        }
      }
    }
    return map;
  }, [matrix, breakPeriods]);

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            Master Timetable
            {!isPrintMode && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                (Drag to move • Single-click to edit • Double-click for details)
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowUnplacedPanel(!showUnplacedPanel)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showUnplacedPanel 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Toggle unplaced lessons panel"
            >
              {showUnplacedPanel ? '📋 Hide Unplaced' : '📋 Show Unplaced'}
            </button>
            <button
              onClick={() => setIsPrintMode(!isPrintMode)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isPrintMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {isPrintMode ? '📄 Print Mode' : '🖨️ Print Preview'}
            </button>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="px-3 py-1.5 border rounded-lg text-sm bg-white"
            >
              <option value={0}>All Days</option>
              {weekdays.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.full}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={`flex bg-white rounded-2xl shadow-xl border overflow-hidden ${isPrintMode ? 'print:shadow-none print:border' : ''}`}>
          <div className="flex-1 overflow-x-auto">
            {selectedDay === 0 ? (
              <table className="w-full min-w-[1400px]" style={{ fontSize: '11px' }}>
                <thead>
                  <tr>
                    <th className="p-2 text-xs font-bold text-slate-600 border-b bg-slate-100 sticky left-0 z-20" 
                        style={{ minWidth: '80px', position: 'sticky', left: 0 }}>
                      Class
                    </th>
                    <th colSpan={visualColumns.length} className="p-2 text-center text-sm font-bold text-white bg-blue-600 border-r">Mon</th>
                    <th colSpan={visualColumns.length} className="p-2 text-center text-sm font-bold text-white bg-emerald-600 border-r">Tue</th>
                    <th colSpan={visualColumns.length} className="p-2 text-center text-sm font-bold text-white bg-amber-600 border-r">Wed</th>
                    <th colSpan={visualColumns.length} className="p-2 text-center text-sm font-bold text-white bg-violet-600 border-r">Thu</th>
                    <th colSpan={visualColumns.length} className="p-2 text-center text-sm font-bold text-white bg-rose-600">Fri</th>
                  </tr>
                  <tr>
                    <th className="p-2 text-xs font-medium text-slate-500 border-b bg-slate-50 sticky left-0 z-20"
                        style={{ position: 'sticky', left: 0 }}>
                      Period →
                    </th>
                    {weekdays.map((day) =>
                      visualColumns.map((col, idx) => {
                        if (col.type === 'break') {
                          return (
                            <th key={`${day.id}-break-${idx}`} className="p-1 text-xs text-center border-r bg-amber-50 text-amber-600 min-w-[36px]">
                              <div className="font-medium text-[9px]">Break</div>
                            </th>
                          )
                        }
                        return (
                          <th key={`${day.id}-${col.period}`} className="p-1 text-xs text-center border-r text-slate-600 min-w-[56px]">
                            <div className="font-medium">P{col.period}</div>
                            {periodTimes?.[col.period] && (
                              <div className="text-[8px] text-slate-400">
                                {periodTimes[col.period].start}
                              </div>
                            )}
                          </th>
                        )
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls: Class) => (
                    <tr key={cls.id}>
                      <td className="p-2 font-bold text-sm text-slate-800 border-b bg-white sticky left-0" 
                          style={{ position: 'sticky', left: 0 }}>
                        {abbreviateClassName(cls.name)}
                      </td>
                      {weekdays.flatMap((day) =>
                        visualColumns.flatMap((col, idx) => {
                          if (col.type === 'break') {
                            return [(
                              <td key={`${cls.id}-${day.id}-break-${idx}`} className="p-0 border-b border-r text-center bg-amber-50" style={{ minHeight: '44px', maxHeight: '52px' }}>
                                <div className="flex items-center justify-center h-full">
                                  <span className="text-[9px] font-semibold text-amber-500 tracking-wide">BREAK</span>
                                </div>
                              </td>
                            )]
                          }
                          const cellKey = buildCellKey(cls.id, day.id, col.period);
                          const mergedInfo = mergedCells.get(cellKey);
                          if (mergedInfo && !mergedInfo.isStart) return [];
                          if (mergedInfo && mergedInfo.isStart) {
                            const mergedSlot = matrix?.[cls.id]?.[day.id]?.[col.period];
                            return [mergedSlot ? (
                              <MergedPeriodCell
                                key={cellKey}
                                slot={mergedSlot}
                                day={day.id}
                                period={col.period}
                                classId={cls.id}
                                colSpan={mergedInfo.colSpan}
                                onSlotClick={(slot) => handleSlotClick(slot, cls.id, day.id, col.period)}
                                onSlotDoubleClick={handleSlotDoubleClick}
                                isPrintMode={isPrintMode}
                                isDragOver={conflictCells.has(cellKey)}
                              />
                            ) : (
                              <TimetableCell
                                key={cellKey}
                                slot={undefined}
                                day={day.id}
                                period={col.period}
                                classId={cls.id}
                                onSlotClick={(slot) => handleSlotClick(slot, cls.id, day.id, col.period)}
                                onSlotDoubleClick={handleSlotDoubleClick}
                                isPrintMode={isPrintMode}
                                isDragOver={conflictCells.has(cellKey)}
                              />
                            )]
                          }
                          return [(
                            <TimetableCell
                              key={cellKey}
                              slot={matrix?.[cls.id]?.[day.id]?.[col.period]}
                              day={day.id}
                              period={col.period}
                              classId={cls.id}
                              onSlotClick={(slot) => handleSlotClick(slot, cls.id, day.id, col.period)}
                              onSlotDoubleClick={handleSlotDoubleClick}
                              isPrintMode={isPrintMode}
                              isDragOver={conflictCells.has(cellKey)}
                            />
                          )]
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[600px]" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th className="p-2 text-xs font-bold text-slate-600 border-b bg-slate-100 sticky left-0 z-20"
                        style={{ minWidth: '80px', position: 'sticky', left: 0 }}>
                      Class
                    </th>
                    <th colSpan={visualColumns.length} className="p-2 text-center text-sm font-bold text-white bg-blue-600">
                      {dayLabels.find((d) => d.id === selectedDay)?.full}
                    </th>
                  </tr>
                  <tr>
                    <th className="p-2 text-xs font-medium text-slate-500 border-b bg-slate-50 sticky left-0 z-20"
                        style={{ position: 'sticky', left: 0 }}>
                      Period →
                    </th>
                    {visualColumns.map((col, idx) => {
                      if (col.type === 'break') {
                        return (
                          <th key={`break-${idx}`} className="p-2 text-xs text-center border-r border-b bg-amber-50 text-amber-600 min-w-[46px]">
                            <div className="font-medium">Break</div>
                          </th>
                        )
                      }
                      return (
                        <th key={col.period} className="p-2 text-xs text-center border-r border-b text-slate-600 min-w-[76px]">
                          <div className="font-medium">Period {col.period}</div>
                          {periodTimes?.[col.period] && (
                            <div className="text-[10px] text-slate-400">
                              {periodTimes[col.period].start}
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((cls: Class) => (
                    <tr key={cls.id}>
                      <td className="p-2 font-bold text-sm text-slate-800 border-b bg-white sticky left-0" 
                          style={{ position: 'sticky', left: 0 }}>
                        {abbreviateClassName(cls.name)}
                      </td>
                      {visualColumns.flatMap((col, idx) => {
                        if (col.type === 'break') {
                          return [(
                            <td key={`${cls.id}-break-${idx}`} className="p-0 border-b border-r text-center bg-amber-50" style={{ minHeight: '44px', maxHeight: '52px' }}>
                              <div className="flex items-center justify-center h-full">
                                <span className="text-[9px] font-semibold text-amber-500 tracking-wide">BREAK</span>
                              </div>
                            </td>
                          )]
                        }
                        const cellKey = buildCellKey(cls.id, selectedDay, col.period);
                        const mergedInfo = mergedCells.get(cellKey);
                        if (mergedInfo && !mergedInfo.isStart) return [];
                        if (mergedInfo && mergedInfo.isStart) {
                          const mergedSlot = matrix?.[cls.id]?.[selectedDay]?.[col.period];
                          return [mergedSlot ? (
                            <MergedPeriodCell
                              key={cellKey}
                              slot={mergedSlot}
                              day={selectedDay}
                              period={col.period}
                              classId={cls.id}
                              colSpan={mergedInfo.colSpan}
                              onSlotClick={(slot) => handleSlotClick(slot, cls.id, selectedDay, col.period)}
                              onSlotDoubleClick={handleSlotDoubleClick}
                              isPrintMode={isPrintMode}
                              isDragOver={conflictCells.has(cellKey)}
                            />
                          ) : (
                            <TimetableCell
                              key={cellKey}
                              slot={undefined}
                              day={selectedDay}
                              period={col.period}
                              classId={cls.id}
                              onSlotClick={(slot) => handleSlotClick(slot, cls.id, selectedDay, col.period)}
                              onSlotDoubleClick={handleSlotDoubleClick}
                              isPrintMode={isPrintMode}
                              isDragOver={conflictCells.has(cellKey)}
                            />
                          )]
                        }
                        return [(
                          <TimetableCell
                            key={cellKey}
                            slot={matrix?.[cls.id]?.[selectedDay]?.[col.period]}
                            day={selectedDay}
                            period={col.period}
                            classId={cls.id}
                            onSlotClick={(slot) => handleSlotClick(slot, cls.id, selectedDay, col.period)}
                            onSlotDoubleClick={handleSlotDoubleClick}
                            isPrintMode={isPrintMode}
                            isDragOver={conflictCells.has(cellKey)}
                          />
                        )]
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {(loadingClasses || loadingMatrix) && (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading timetable...</p>
            </div>
          )}
        </div>

        {!isPrintMode && showUnplacedPanel && !loadingClasses && !loadingMatrix && (
          <UnplacedLessonsPanel
            schoolId={schoolId}
            termId={termId}
            matrix={matrix}
          />
        )}

        {!isPrintMode && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span className="font-medium">Actions:</span>
            <span className="text-gray-500">Drag a slot to move/swap</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">Click empty cell to add</span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">Drag from unplaced panel to place new lessons</span>
          </div>
        )}
      </div>

      <DragOverlay>
        {activeDragSlot ? <DragOverlayContent slot={activeDragSlot} /> : null}
        {activeUnplacedDrag ? <UnplacedDragOverlayContent subjectName={activeUnplacedDrag.subjectName} teacherName={activeUnplacedDrag.teacherName} /> : null}
      </DragOverlay>

      {notification && (
        <div
          key={notification.key}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-lg text-sm font-medium shadow-2xl transition-all duration-300 animate-bounce-once ${
            notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
          }`}
          style={{ animation: 'slideUpFade 0.3s ease-out' }}
        >
          {notification.message}
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>

      <TimetableEditorModal
        isOpen={editModalOpen}
        onClose={handleEditModalClose}
        termId={termId}
        initialSlot={editSlot}
        mode={editMode}
        schoolId={schoolId}
        prefill={unplacedPrefill}
      />
    </DndContext>
  );
}
