'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { parentApi } from '@/lib/api';
import { PortalProgress } from '@/components/progress/portal-progress';

export default function ParentAcademicProgressPage() {
  const [studentId, setStudentId] = useState('');
  const { data } = useQuery({ queryKey: ['progress-parent-children'], queryFn: () => parentApi.getChildren().then(response => response.data?.data || response.data || []) });
  const children = Array.isArray(data) ? data : data?.children || [];
  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8"><section className="rounded-2xl bg-white p-5 shadow-sm"><label className="text-sm font-semibold text-slate-700">Child<select value={studentId} onChange={event => setStudentId(event.target.value)} className="ml-3 rounded-lg border border-slate-300 px-3 py-2"><option value="">Select a child</option>{children.map((child: any) => <option key={child.id || child.studentId} value={child.id || child.studentId}>{child.firstName ? `${child.firstName} ${child.lastName || ''}` : child.name}</option>)}</select></label></section>{studentId ? <PortalProgress studentId={studentId} parent /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Select a child to view their academic journey.</div>}</main>;
}
