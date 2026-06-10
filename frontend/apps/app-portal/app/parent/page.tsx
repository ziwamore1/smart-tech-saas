'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { parentApi, termApi } from '@/lib/api';

interface ChildResult {
  child: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    class: string;
  };
  results: {
    id: string;
    subject: string;
    term: string;
    academicYear: string;
    score: number;
    grade: string;
    remark: string;
  }[];
}

interface AllChildrenResults {
  term: string | null;
  academicYear: string | null;
  children: ChildResult[];
}

function getGradeColor(score: number): string {
  if (score >= 75) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 50) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function SubjectHeatBar({ score }: { score: number }) {
  const width = Math.min(score, 100);
  const color = score >= 75 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function ClassBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
      {name}
    </span>
  );
}

export default function ParentDashboard() {
  const { user } = useAuth();

  const { data: termData } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent().then(r => r.data),
    retry: false,
  });

  const { data: allData, isLoading } = useQuery<AllChildrenResults>({
    queryKey: ['parent-all-children-results'],
    queryFn: () => parentApi.getAllChildrenResults().then(r => r.data),
    retry: false,
  });

  const termName = termData?.data?.name || allData?.term || 'Current Term';
  const children = allData?.children || [];

  const allSubjects = [...new Set(children.flatMap(c => c.results.map(r => r.subject)))];

  const getChildScore = (child: ChildResult, subject: string) =>
    child.results.find(r => r.subject === subject);

  const overallAverage = () => {
    const all = children.flatMap(c => c.results);
    if (all.length === 0) return 0;
    return (all.reduce((s, r) => s + r.score, 0) / all.length).toFixed(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome, {user?.firstName || 'Parent'}!
        </h1>
        <p className="text-gray-600 mt-1">
          {termName} — See how all your children are performing at a glance
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading your children&apos;s data...</div>
      ) : children.length === 0 ? (
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No children linked yet</h2>
          <p className="text-gray-500">Contact your school to link your children to this parent account.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Children</p>
              <p className="text-2xl font-bold text-gray-900">{children.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Subjects Tracked</p>
              <p className="text-2xl font-bold text-gray-900">{allSubjects.length}</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Overall Average</p>
              <p className="text-2xl font-bold text-blue-600">{overallAverage()}%</p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-500">Term</p>
              <p className="text-2xl font-bold text-gray-900">{termName}</p>
            </div>
          </div>

          {/* Side-by-Side Subject Comparison */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Subject Comparison — All Children</h2>
              <p className="text-sm text-gray-500 mt-0.5">Scores across all your children for each subject</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-6 font-semibold text-gray-700 text-sm">Subject</th>
                    {children.map(child => (
                      <th key={child.child.id} className="text-center py-3 px-4 font-semibold text-gray-700 text-sm min-w-[140px]">
                        <div>{child.child.firstName} {child.child.lastName}</div>
                        <ClassBadge name={child.child.class} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allSubjects.map((subject, idx) => (
                    <tr key={subject} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="py-4 px-6 font-medium text-gray-800 whitespace-nowrap">{subject}</td>
                      {children.map(child => {
                        const result = getChildScore(child, subject);
                        return (
                          <td key={child.child.id} className="py-4 px-4 text-center">
                            {result ? (
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getGradeColor(result.score)}`}>
                                  {result.score.toFixed(1)}% — {result.grade}
                                </span>
                                <SubjectHeatBar score={result.score} />
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-Child Detail Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {children.map(childData => {
              const avg = childData.results.length > 0
                ? (childData.results.reduce((s, r) => s + r.score, 0) / childData.results.length).toFixed(1)
                : '—';
              return (
                <div key={childData.child.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {childData.child.firstName} {childData.child.lastName}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {childData.child.admissionNumber} · <ClassBadge name={childData.child.class} />
                      </p>
                    </div>
                    <span className="text-lg font-bold text-blue-600">{avg}%</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {childData.results.length === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-gray-400">No results yet</p>
                    ) : (
                      childData.results.map(r => (
                        <div key={r.id} className="flex items-center justify-between px-5 py-3">
                          <span className="text-sm font-medium text-gray-700">{r.subject}</span>
                          <div className="flex items-center gap-3">
                            <SubjectHeatBar score={r.score} />
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border min-w-[70px] justify-center ${getGradeColor(r.score)}`}>
                              {r.score.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Links */}
          <div className="flex gap-3">
            <Link href="/parent/timetable" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              View Timetables
            </Link>
            <Link href="/parent/results" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Detailed Results
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
