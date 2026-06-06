"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { timetableApi, subjectApi, teacherApi, classApi } from "@/lib/api";
import { abbreviateSubject, abbreviateTeacher, abbreviateClassName } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";
import { getSubjectColor } from "@/config/subjectColors";
import type { ClassMatrix, Lesson } from "@/types/timetable";

function DraggableLessonCard({
  lesson,
  classId,
  subjectId,
  teacherId,
  subjectName,
  teacherName,
  className,
}: {
  lesson: any;
  classId: string;
  subjectId: string;
  teacherId: string;
  subjectName: string;
  teacherName: string;
  className: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unplaced-${lesson.id}-${classId}-${subjectId}`,
    data: {
      type: "unplaced-lesson",
      lesson,
      classId,
      subjectId,
      teacherId,
      subjectName,
      teacherName,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const colorConfig = getSubjectColor(subjectName);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-grab active:cursor-grabbing border transition-all ${
        isDragging ? 'opacity-50 ring-2 ring-blue-400' : 'hover:shadow-sm hover:border-blue-300'
      } ${colorConfig.border} ${colorConfig.bg}`}
    >
      <span className={`font-bold text-[10px] ${colorConfig.text}`}>
        {abbreviateSubject(subjectName)}
      </span>
      <TooltipWrap text={className}>
        <span className="text-[9px] text-slate-500 truncate max-w-[40px]">
          {abbreviateClassName(className)}
        </span>
      </TooltipWrap>
      {teacherName && (
        <TooltipWrap text={teacherName}>
          <span className="text-[9px] text-slate-400 truncate max-w-[40px] ml-auto">
            {abbreviateTeacher(teacherName)}
          </span>
        </TooltipWrap>
      )}
    </div>
  );
}

export default function UnplacedLessonsPanel({
  schoolId,
  termId,
  matrix,
}: {
  schoolId: string;
  termId: string;
  matrix: ClassMatrix;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const { data: lessons = [] } = useQuery({
    queryKey: ["unplaced-lessons", schoolId, termId],
    queryFn: async () => {
      const res = await timetableApi.getAllLessonRequirements();
      const data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const res = await teacherApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes", schoolId],
    queryFn: async () => {
      const res = await classApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!schoolId,
  });

  const subjectMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of subjects) {
      map[s.id] = s.name;
    }
    return map;
  }, [subjects]);

  const teacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of teachers) {
      const fn = t.user?.firstName || t.firstName || "";
      const ln = t.user?.lastName || t.lastName || "";
      map[t.id] = fn && ln ? `${fn} ${ln}` : fn || ln || "";
    }
    return map;
  }, [teachers]);

  const classMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of classes) {
      map[c.id] = c.name;
    }
    return map;
  }, [classes]);

  const unplacedLessons = useMemo(() => {
    const result: Array<{
      lesson: any;
      classId: string;
      subjectId: string;
      teacherId: string;
      subjectName: string;
      teacherName: string;
      className: string;
      unplacedCount: number;
    }> = [];

    for (const lesson of lessons) {
      const classId = lesson.classId;
      const subjectId = lesson.subjectId;
      const teacherId = lesson.teacherId;
      const lessonsPerWeek = lesson.lessonsPerWeek || 1;
      const subjectName = subjectMap[subjectId] || "Unknown";
      const teacherName = teacherMap[teacherId] || "";
      const className = classMap[classId] || classId;

      const classSlots = matrix[classId] || {};
      let placedCount = 0;

      for (const dayKey of Object.keys(classSlots)) {
        const day = Number(dayKey);
        const periods = classSlots[day] || {};
        for (const periodKey of Object.keys(periods)) {
          const slot = periods[Number(periodKey)];
          if (slot?.subject?.id === subjectId || slot?.subject?.name === subjectName) {
            placedCount++;
          }
        }
      }

      const unplacedCount = Math.max(0, lessonsPerWeek - placedCount);
      if (unplacedCount > 0) {
        result.push({
          lesson,
          classId,
          subjectId,
          teacherId,
          subjectName,
          teacherName,
          className,
          unplacedCount,
        });
      }
    }

    result.sort((a, b) => a.className.localeCompare(b.className));
    return result;
  }, [lessons, matrix, subjectMap, teacherMap, classMap]);

  const groupedByClass = useMemo(() => {
    const groups: Record<string, typeof unplacedLessons> = {};
    for (const item of unplacedLessons) {
      if (!groups[item.className]) groups[item.className] = [];
      groups[item.className].push(item);
    }
    return groups;
  }, [unplacedLessons]);

  if (lessons.length === 0) return null;

  return (
    <div className={`border-l bg-white transition-all ${isCollapsed ? 'w-0 overflow-hidden border-l-0' : 'w-72 min-w-[18rem]'}`}>
      <div className="flex items-center justify-between p-3 border-b bg-slate-50 sticky top-0">
        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span className="text-base">📋</span>
          Unplaced
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-semibold">
            {unplacedLessons.length}
          </span>
        </h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded hover:bg-slate-200 transition-all"
          title={isCollapsed ? "Show panel" : "Hide panel"}
        >
          {isCollapsed ? "◀" : "✕"}
        </button>
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-200px)] p-2 space-y-3">
        {unplacedLessons.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-green-600 text-sm font-medium">✓ All lessons placed</p>
            <p className="text-xs text-slate-400 mt-1">No unplaced lessons remaining</p>
          </div>
        ) : (
          Object.entries(groupedByClass).map(([className, items]) => (
            <div key={className}>
              <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
                <TooltipWrap text={className}>
                  <span>{abbreviateClassName(className)}</span>
                </TooltipWrap>
              </h4>
              <div className="space-y-1">
                {items.map((item) => (
                  <div key={`${item.lesson.id}-${item.subjectId}`} className="group relative">
                    <DraggableLessonCard
                      lesson={item.lesson}
                      classId={item.classId}
                      subjectId={item.subjectId}
                      teacherId={item.teacherId}
                      subjectName={item.subjectName}
                      teacherName={item.teacherName}
                      className={item.className}
                    />
                    {item.unplacedCount > 1 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                        {item.unplacedCount}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2 border-t text-[9px] text-slate-400 text-center">
        Drag cards onto the grid to place
      </div>
    </div>
  );
}
