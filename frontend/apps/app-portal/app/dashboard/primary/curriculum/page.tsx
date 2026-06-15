'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

const CURRICULUM_AREAS = [
  {
    name: 'Literacy & Languages',
    icon: 'fa-book-open',
    color: '#3b82f6',
    description: 'English, Zambian Languages, Reading & Comprehension',
    grades: 'Pre–Grade 7',
    outcomes: 'Reading fluency, writing skills, oral communication',
  },
  {
    name: 'Numeracy & Mathematics',
    icon: 'fa-calculator',
    color: '#10b981',
    description: 'Number sense, operations, geometry, measurement, data handling',
    grades: 'Pre–Grade 7',
    outcomes: 'Problem solving, numerical reasoning, mathematical thinking',
  },
  {
    name: 'Science & Technology',
    icon: 'fa-flask',
    color: '#8b5cf6',
    description: 'Basic science, health education, technology studies (Gr 5–7)',
    grades: 'Grade 1–7',
    outcomes: 'Scientific inquiry, environmental awareness, technological literacy',
  },
  {
    name: 'Social Studies',
    icon: 'fa-globe-africa',
    color: '#f59e0b',
    description: 'History, geography, civics, Zambian culture & heritage',
    grades: 'Grade 1–7',
    outcomes: 'Cultural identity, civic responsibility, global awareness',
  },
  {
    name: 'Creative & Expressive Arts',
    icon: 'fa-palette',
    color: '#ec4899',
    description: 'Art, music, drama, dance, physical education',
    grades: 'Pre–Grade 7',
    outcomes: 'Creativity, self-expression, physical development',
  },
  {
    name: 'Religious & Moral Education',
    icon: 'fa-hands-helping',
    color: '#0891b2',
    description: 'Religious education, moral values, ethics',
    grades: 'Grade 1–7',
    outcomes: 'Moral reasoning, ethical values, spiritual awareness',
  },
];

const SYLLABUS_OVERVIEW = [
  { stage: 'Pre-School (ECE)', grades: 'Pre', focus: 'School readiness, foundational skills, socialisation', assessment: 'Developmental checklist' },
  { stage: 'Lower Primary', grades: 'Grade 1–3', focus: 'Basic literacy, numeracy, foundational concepts', assessment: 'Continuous assessment' },
  { stage: 'Upper Primary', grades: 'Grade 4–6', focus: 'Subject depth, critical thinking, application', assessment: 'School-based + ECZ mock' },
  { stage: 'ECZ Preparation', grades: 'Grade 7', focus: 'National exam preparation, revision, selection', assessment: 'ECZ National Assessment' },
];

export default function PrimaryCurriculumPage() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Primary Curriculum</h1>
          <p className="text-gray-500 text-sm mt-1">Zambian Primary School Syllabus — Learning Areas & Outcomes</p>
        </div>
        <Link
          href="/dashboard/curriculum"
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
        >
          <i className="fas fa-cog" />
          Full Curriculum Settings
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CURRICULUM_AREAS.map(area => (
          <button
            key={area.name}
            onClick={() => setSelectedArea(selectedArea === area.name ? null : area.name)}
            className={`bg-white rounded-xl border p-5 text-left transition-all ${
              selectedArea === area.name ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: area.color }}>
                <i className={`fas ${area.icon}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{area.name}</h3>
                <p className="text-xs text-gray-400">{area.grades}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">{area.description}</p>
          </button>
        ))}
      </div>

      {selectedArea && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{selectedArea} — Learning Outcomes</h3>
            <button onClick={() => setSelectedArea(null)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {CURRICULUM_AREAS.find(a => a.name === selectedArea)?.outcomes || 'Comprehensive learning outcomes aligned to the Zambian Primary Curriculum.'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7'].map(grade => (
              <div key={grade} className="flex items-center justify-between p-3 bg-white rounded-lg border border-emerald-100">
                <span className="text-sm font-medium text-gray-700">{grade}</span>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">View Outcomes →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Syllabus Overview</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {SYLLABUS_OVERVIEW.map(stage => (
            <div key={stage.stage} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-gray-50">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium text-gray-900">{stage.stage}</p>
                <p className="text-xs text-gray-500">{stage.grades}</p>
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-gray-600">{stage.focus}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">{stage.assessment}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
