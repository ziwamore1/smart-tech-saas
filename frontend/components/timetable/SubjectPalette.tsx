"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { getSubjectColor } from "@/config/subjectColors";
import { subjectApi } from "@/lib/api";

type Subject = {
  id: string;
  name: string;
};

function SubjectItem({ subject }: { subject: Subject }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `subject-${subject.id}`,
      data: { subject },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const colorConfig = getSubjectColor(subject.name);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`
        p-3 rounded-xl border cursor-grab text-sm font-medium transition-all duration-200
        ${colorConfig.bg} ${colorConfig.border} ${colorConfig.text}
        ${isDragging ? "opacity-70 shadow-xl scale-105 cursor-grabbing" : `hover:shadow-md hover:scale-[1.02] ${colorConfig.hover}`}
      `}
    >
      <div className="flex items-center gap-2">
        {/* Subject Icon */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center bg-white/50
        `}>
          <span className="text-xs font-bold">
            {subject.name.substring(0, 2).toUpperCase()}
          </span>
        </div>
        <span>{subject.name}</span>
      </div>
    </div>
  );
}

export default function SubjectPalette({
  schoolId,
}: {
  schoolId: string;
}) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    loadSubjects();
  }, [schoolId]);

  const loadSubjects = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await subjectApi.getAll();

      setSubjects(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    return subjects.filter((subject) =>
      subject.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [subjects, search]);

  return (
    <div className="w-full space-y-3">

      {/* HEADER */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-slate-800">Subjects</div>
          <div className="text-xs text-slate-500">Drag to add lessons</div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-xl p-2.5 text-sm pl-9 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
        />
        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* CONTENT */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">

        {loading && (
            <div className="text-sm text-slate-500 flex items-center gap-2 p-3">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Loading subjects...
            </div>
        )}

        {error && (
          <div className="text-sm text-red-500 p-3 bg-red-50 rounded-lg">
            {error}
            <button
              onClick={loadSubjects}
              className="block mt-2 text-blue-600 underline text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {!loading &&
          !error &&
          filteredSubjects.map((subject) => (
            <SubjectItem
              key={subject.id}
              subject={subject}
            />
          ))}

        {!loading &&
          !error &&
          filteredSubjects.length === 0 && (
            <div className="text-sm text-slate-400 text-center p-4">
              No subjects found.
            </div>
          )}

      </div>

      {/* Stats */}
      <div className="pt-2 border-t border-slate-100">
        <div className="text-xs text-slate-500 text-center">
          {filteredSubjects.length} subject{filteredSubjects.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </div>
  );
}
