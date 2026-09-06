'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AiTutorChat from '@/components/ai-tutor-chat';
import { parentApi, subjectApi } from '@/lib/api';

interface ChildInfo {
  id: string;
  firstName: string;
  lastName: string;
  className?: string;
  class?: string;
  photoUrl?: string | null;
}

export default function ParentAiTutorPage() {
  const [selectedChildId, setSelectedChildId] = useState<string>('');

  const { data: childrenData } = useQuery({
    queryKey: ['parent-children-ai'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
    retry: false,
  });

  const children = (Array.isArray(childrenData) ? childrenData : []) as ChildInfo[];

  useEffect(() => {
    if (!selectedChildId && children.length > 0) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-ai-parent'],
    queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data || []),
    retry: false,
  });

  const subjects = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    (Array.isArray(subjectsData) ? subjectsData : []).forEach((s: any) => {
      if (s?.name && !seen.has(s.name)) {
        seen.add(s.name);
        out.push({ id: s.id, name: s.name });
      }
    });
    return out;
  }, [subjectsData]);

  const activeChild = children.find(c => c.id === selectedChildId);
  const childName = activeChild ? `${activeChild.firstName} ${activeChild.lastName}`.trim() : '';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/parent" className="hover:text-indigo-600">Dashboard</Link>
            <span>/</span>
            <span>AI Tutor</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Tutor</h1>
          <p className="text-gray-500 mt-1">
            Understand your child&apos;s performance, ask about their learning, or get help with any SmartTech or school question.
          </p>
        </div>
      </div>

      {children.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm font-medium text-gray-600 mb-3">Select a child</p>
          <div className="flex gap-2 flex-wrap">
            {children.map((c) => {
              const active = c.id === selectedChildId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedChildId(c.id)}
                  className={`px-4 py-2.5 rounded-xl text-left border-2 transition-all ${
                    active ? 'bg-indigo-50 border-indigo-500' : 'bg-gray-50 border-transparent hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${active ? 'text-indigo-700' : 'text-gray-800'}`}>{c.firstName} {c.lastName}</p>
                  <p className="text-xs text-gray-500">{c.className || c.class || 'Not assigned'}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AiTutorChat
        studentId={selectedChildId}
        role="parent"
        childName={childName || undefined}
        subjectsOverride={subjects}
      />
    </div>
  );
}
