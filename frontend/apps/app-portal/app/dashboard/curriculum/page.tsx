'use client';

import Link from 'next/link';

const sections = [
  { name: 'Education Levels', href: '/dashboard/curriculum/education-levels', icon: 'fa-layer-group', color: '#3b82f6', desc: 'Configure ECE, Primary, Secondary, Advanced Secondary levels' },
  { name: 'Curriculum Versions', href: '/dashboard/curriculum/versions', icon: 'fa-code-branch', color: '#10b981', desc: 'Manage curriculum versions and effective periods' },
  { name: 'Academic Stages', href: '/dashboard/curriculum/stages', icon: 'fa-stairs', color: '#8b5cf6', desc: 'Define grades, forms, and academic stages per level' },
  { name: 'Subject Groups', href: '/dashboard/curriculum/subject-groups', icon: 'fa-object-group', color: '#f59e0b', desc: 'Group subjects by category (core, elective, optional)' },
  { name: 'Composite Subjects', href: '/dashboard/curriculum/composite-subjects', icon: 'fa-puzzle-piece', color: '#06b6d4', desc: 'Combine component subjects into a single computed score for report cards (Grades 10-12)' },
  { name: 'Conversion Rules', href: '/dashboard/curriculum/conversion-rules', icon: 'fa-exchange-alt', color: '#ef4444', desc: 'ECZ Grade 7 raw-to-standardized score conversion' },
  { name: 'Division Rules', href: '/dashboard/curriculum/divisions', icon: 'fa-trophy', color: '#14b8a6', desc: 'Per-subject and composite division cutoff rules' },
  { name: 'Performance Categories', href: '/dashboard/curriculum/performance-categories', icon: 'fa-chart-line', color: '#f97316', desc: 'Define performance labels and score ranges' },
  { name: 'Exam Structures', href: '/dashboard/curriculum/exam-structures', icon: 'fa-file-alt', color: '#ec4899', desc: 'Configure exam structures, components, and scoring' },
  { name: 'Grade 7 ECZ', href: '/dashboard/curriculum/grade7', icon: 'fa-graduation-cap', color: '#7c3aed', desc: 'Compute standardized scores, rank, and manage ECZ Grade 7 results' },
  { name: 'Form 1 Selection', href: '/dashboard/curriculum/selection', icon: 'fa-arrow-right', color: '#0d9488', desc: 'Analyze Grade 7 performance for secondary school selection placement' },
];

export default function CurriculumPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Curriculum Configuration</h1>
        <p className="text-gray-500 mt-1">Configure education levels, curriculum versions, academic stages, and ECZ-aligned scoring rules for your school.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl shrink-0"
                  style={{ backgroundColor: s.color }}
                >
                  <i className={`fas ${s.icon}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{s.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
