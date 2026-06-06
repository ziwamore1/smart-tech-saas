"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import type { Teacher } from "@/types/timetable";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VirtualTeacherListProps {
  teachers: Teacher[];
  onTeacherClick?: (teacher: Teacher) => void;
  onRemove?: (id: string) => void;
  itemHeight?: number;
  height?: number;
}

export default function VirtualTeacherList({
  teachers,
  onTeacherClick,
  onRemove,
  itemHeight = 56,
  height = 400,
}: VirtualTeacherListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: teachers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5,
  });

  if (teachers.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No teachers to display.
      </Card>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const teacher = teachers[virtualRow.index];
          return (
            <Card
              key={teacher.id}
              className="absolute left-0 top-0 w-full p-3 hover:shadow-sm transition-shadow cursor-pointer"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onTeacherClick?.(teacher)}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                  style={{ backgroundColor: teacher.color || "#6B7280" }}
                >
                  {teacher.abbreviation || teacher.firstName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {teacher.title ? `${teacher.title} ` : ""}
                    {teacher.firstName} {teacher.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {teacher.gender || "No gender set"}
                  </div>
                </div>
                <Badge variant="outline">
                  {teacher.email || "No email"}
                </Badge>
                {onRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(teacher.id);
                    }}
                    className="px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
