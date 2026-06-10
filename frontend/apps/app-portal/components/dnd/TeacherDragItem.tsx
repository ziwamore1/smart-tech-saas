"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Teacher } from "@/types/timetable";
import { Card } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

interface TeacherDragItemProps {
  teacher: Teacher;
}

export default function TeacherDragItem({ teacher }: TeacherDragItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `teacher-${teacher.id}`,
    data: { teacher },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? "ring-2 ring-indigo-500 shadow-lg" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div {...listeners} {...attributes} className="text-gray-400 hover:text-gray-600">
          <GripVertical className="w-4 h-4" />
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: teacher.color || "#6B7280" }}
        >
          {teacher.abbreviation || teacher.firstName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {teacher.title ? `${teacher.title} ` : ""}
            {teacher.firstName} {teacher.lastName}
          </div>
        </div>
      </div>
    </Card>
  );
}
