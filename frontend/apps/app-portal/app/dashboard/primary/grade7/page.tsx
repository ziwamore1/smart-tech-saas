'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, studentApi } from '@/lib/api';

const ECZ_SUBJECTS = [
  { name: 'English', code: 'ENG', weight: 'Composite', color: '#3b82f6' },
  { name: 'Mathematics', code: 'MTH', weight: 'Composite', color: '#10b981' },
  { name: 'Science', code: 'SCI', weight: 'Composite', color: '#8b5cf6' },
  { name: 'Social Studies', code: 'SST', weight: 'Composite', color: '#f59e0b' },
  { name: 'Zambian Language', code: 'ZAM', weight: 'Composite', color: '#ec4899' },
  { name: 'Religious Education', code: 'RE', weight: 'Composite', color: '#0891b2' },
];

const PREPARATION_MILESTONES = [
  { stage: 'Syllabus Coverage', desc: 'Complete Grade 7 syllabus for all examinable subjects', status: 'pending' },
  { stage: 'Mock Exam 1', desc: 'First mock examination under timed conditions', status: 'pending' },
  { stage: 'Remedial Teaching', desc: 'Address gaps identified in Mock 1', status: 'pending' },
  { stage: 'Mock Exam 2', desc: 'Second mock with ECZ-style questions', status: 'pending' },
  { stage: 'Past Papers', desc: 'Practice with past ECZ papers (last 5 years)', status: 'pending' },
  { stage: 'Final Revision', desc: 'Intensive revision before national exam', status: 'pending' },
];

export default function Grade7Page() {
  const [activeSection, setActiveSection] = useState<'overview' | 'mock-exams' | 'selection'>('overview');

  const { data: students } = useQuery({
    queryKey: ['grade7-students'],
    queryFn: () => studentApi.getAll({ grade: '7' }).then(r => r.data?.data || r.data || []),
  });

  const grade7Students = (students || []).filter((s: any) => {
    const grade = s.grade || s.className || '';
    return grade.includes('7') || grade.includes('Seven') || grade.includes('seven');
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grade 7 ECZ Preparation</h1>
          <p className="text-gray-500 text-sm mt-1">National Examination preparation, mock exams, and placement prediction</p>
        </div>
        <Link
          href="/dashboard/curriculum/exam-structures"
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
        >
          <i className="fas fa-cog" />
          ECZ Exam Settings
        </Link>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 text-2xl">
            <i className="fas fa-graduation-cap" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">Grade 7 National Assessment</h2>
            <p className="text-sm text-gray-600 mt-1">
              Prepare your Grade 7 learners for the ECZ Grade 7 National Assessment.
              Track syllabus coverage, conduct mock exams, and predict secondary school placement.
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600">{grade7Students.length}</p>
            <p className="text-xs text-gray-500">Candidates</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {[
          { key: 'overview' as const, label: 'Exam Overview', icon: 'fa-clipboard-list' },
          { key: 'mock-exams' as const, label: 'Mock Exams', icon: 'fa-pencil-alt' },
          { key: 'selection' as const, label: 'Selection Prediction', icon: 'fa-chart-line' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all ${
              activeSection === tab.key
                ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`fas ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ECZ_SUBJECTS.map(subj => (
              <div key={subj.code} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: subj.color }}>
                    <i className="fas fa-book" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{subj.name}</h3>
                    <p className="text-xs text-gray-400">Code: {subj.code}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{subj.weight}</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">Syllabus: —%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Preparation Milestones</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {PREPARATION_MILESTONES.map((m, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      m.status === 'completed' ? 'bg-emerald-100 text-emerald-600' :
                      m.status === 'in-progress' ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{m.stage}</p>
                      <p className="text-xs text-gray-500">{m.desc}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    m.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    m.status === 'in-progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {m.status === 'completed' ? 'Done' : m.status === 'in-progress' ? 'In Progress' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeSection === 'mock-exams' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4 text-gray-300"><i className="fas fa-pencil-alt" /></div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Mock Exam Management</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Create and manage mock examinations for Grade 7 candidates. Set papers, record scores, and analyse performance per subject and per learner.
          </p>
          <button className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            Create Mock Exam
          </button>
        </div>
      )}

      {activeSection === 'selection' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4 text-gray-300"><i className="fas fa-chart-line" /></div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Selection Prediction</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Predict Grade 7 learners' placement into Grade 8 based on mock exam performance.
            Analyse selection criteria and generate placement reports.
          </p>
          <button className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            Generate Predictions
          </button>
        </div>
      )}
    </div>
  );
}
