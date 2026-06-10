"use client";

import { useDroppable } from "@dnd-kit/core";
import type { Lesson, Teacher, Classroom } from "@/types/timetable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

interface ClassDropZoneProps {
  classId: string;
  className: string;
  lessons: Lesson[];
  teachers: Teacher[];
  classrooms: Classroom[];
  onAssign: (lesson: Lesson) => void;
}

export default function ClassDropZone({
  classId,
  className,
  lessons,
  teachers,
  classrooms,
  onAssign,
}: ClassDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `class-drop-${classId}`,
    data: { classId },
  });

  const classLessons = lessons.filter((l) => l.classId === classId);

  return (
    <Card
      ref={setNodeRef}
      className={`p-4 transition-all ${
        isOver
          ? "ring-2 ring-indigo-500 bg-indigo-50/50 shadow-lg scale-[1.01]"
          : "hover:shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{className}</h3>
        <Badge variant="secondary">{classLessons.length} lessons</Badge>
      </div>

      {classLessons.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
          <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Drag teachers here or click to add lessons</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classLessons.map((lesson) => {
            const teacher = teachers.find((t) => t.id === lesson.teacherId);
            const classroom = classrooms.find((c) => c.id === lesson.classroomId);
            return (
              <Card key={lesson.id} className="p-2 flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: teacher?.color || "#6B7280" }}
                >
                  {teacher?.abbreviation || teacher?.firstName?.[0] || "?"}
                </div>
                <div className="flex-1 text-sm">
                  <span className="font-medium">{teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unassigned"}</span>
                  {classroom && <span className="text-muted-foreground ml-2">{classroom.name}</span>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </Card>
  );
}
