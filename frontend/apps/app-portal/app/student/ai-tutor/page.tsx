'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import AiTutorChat from '@/components/ai-tutor-chat';
import { studentApi, studentSubjectApi, subjectApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function StudentAiTutorPage() {
  const { user } = useAuth();

  const { data: studentData } = useQuery({
    queryKey: ['my-profile-ai-tutor'],
    queryFn: () => studentApi.getById('me').then(r => r.data),
    retry: false,
  });

  const student = studentData?.data || studentData;

  const { data: termData } = useQuery({
    queryKey: ['current-term-ai'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });
  const termId = termData?.data?.id;

  const studentId = student?.id || '';

  const { data: mySubjects } = useQuery({
    queryKey: ['student-my-subjects-ai', studentId, termId],
    queryFn: () => studentSubjectApi.getByStudent(studentId).then(r => r.data?.data || r.data || []),
    enabled: !!studentId,
    retry: false,
  });

  const { data: allSubjects } = useQuery({
    queryKey: ['all-subjects-ai'],
    queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data || []),
    retry: false,
  });

  const subjects = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    const pool: any[] = [];
    if (Array.isArray(mySubjects) && mySubjects.length > 0) pool.push(...mySubjects);
    if (Array.isArray(allSubjects)) pool.push(...allSubjects);
    (pool as any[]).forEach((s: any) => {
      const id = s?.subjectId || s?.subject?.id || s?.id;
      const name = s?.subject?.name || s?.name;
      if (id && name && !seen.has(name)) {
        seen.add(name);
        out.push({ id, name });
      }
    });
    return out;
  }, [mySubjects, allSubjects]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/student" className="hover:text-indigo-600">Dashboard</Link>
            <span>/</span>
            <span>AI Tutor</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Tutor</h1>
          <p className="text-gray-500 mt-1">
            Learn from your subjects, get explanations and practice — {student?.firstName ? `welcome, ${student.firstName}!` : 'anytime you need.'}
          </p>
        </div>
      </div>

      <AiTutorChat studentId={studentId} role="student" subjectsOverride={subjects.length > 0 ? subjects : undefined} />
    </div>
  );
}
