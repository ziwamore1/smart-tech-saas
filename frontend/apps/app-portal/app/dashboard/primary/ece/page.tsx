'use client';

import { useState } from 'react';
import Link from 'next/link';

const ECE_LEARNING_AREAS = [
  { name: 'Language & Literacy', icon: 'fa-book-open', color: '#3b82f6', desc: 'Oral language, pre-reading, pre-writing, vocabulary development' },
  { name: 'Numeracy', icon: 'fa-calculator', color: '#10b981', desc: 'Number recognition, counting, shapes, patterns, basic operations' },
  { name: 'Creative Arts', icon: 'fa-palette', color: '#ec4899', desc: 'Drawing, painting, modelling, music, movement, dramatic play' },
  { name: 'Psychomotor Skills', icon: 'fa-running', color: '#f59e0b', desc: 'Fine motor, gross motor, hand-eye coordination, outdoor play' },
  { name: 'Social & Emotional', icon: 'fa-heart', color: '#ef4444', desc: 'Self-awareness, social skills, emotional regulation, cooperation' },
  { name: 'Environmental Awareness', icon: 'fa-leaf', color: '#059669', desc: 'Nature exploration, hygiene, safety, basic science concepts' },
];

const ECE_MILESTONES = [
  { age: '3–4 Years', area: 'Language', milestone: 'Speaks in simple sentences, follows 2-step instructions' },
  { age: '3–4 Years', area: 'Motor', milestone: 'Holds crayon with tripod grip, jumps with both feet' },
  { age: '4–5 Years', area: 'Numeracy', milestone: 'Counts to 20, recognises numbers 1–10' },
  { age: '4–5 Years', area: 'Social', milestone: 'Plays cooperatively, shares with peers' },
  { age: '5–6 Years', area: 'Literacy', milestone: 'Recognises letters, writes own name, identifies letter sounds' },
  { age: '5–6 Years', area: 'Numeracy', milestone: 'Counts to 50, simple addition/subtraction with objects' },
  { age: '5–6 Years', area: 'Creative', milestone: 'Draws representational pictures, sings with memory' },
];

export default function EcePage() {
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Early Childhood Education (ECE)</h1>
          <p className="text-gray-500 text-sm mt-1">Pre-school learning areas, developmental milestones, and assessment tracking</p>
        </div>
        <Link
          href="/dashboard/curriculum/education-levels"
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
        >
          <i className="fas fa-cog" />
          ECE Settings
        </Link>
      </div>

      <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border border-pink-200 p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-pink-100 flex items-center justify-center text-pink-600 text-2xl">
            <i className="fas fa-baby" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">ECE Module Overview</h2>
            <p className="text-sm text-gray-600 mt-1">
              The Early Childhood Education module supports pre-school learning following the Zambian ECE curriculum framework.
              Track developmental milestones, assess learning areas, and prepare children for Grade 1.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-gray-900">Learning Areas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ECE_LEARNING_AREAS.map(area => (
          <button
            key={area.name}
            onClick={() => setSelectedArea(selectedArea === area.name ? null : area.name)}
            className={`bg-white rounded-xl border p-5 text-left transition-all ${
              selectedArea === area.name ? 'border-pink-500 ring-2 ring-pink-100' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: area.color }}>
                <i className={`fas ${area.icon}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{area.name}</h3>
                <p className="text-xs text-gray-400">Learning area</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">{area.desc}</p>
          </button>
        ))}
      </div>

      {selectedArea && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">{selectedArea} — Details</h3>
            <button onClick={() => setSelectedArea(null)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Comprehensive activities and assessment criteria for {selectedArea} in the ECE programme.
            Track individual learner progress against developmental milestones.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-white rounded-lg border border-pink-100">
              <p className="text-sm font-medium text-gray-700">Activities</p>
              <p className="text-xs text-gray-500 mt-1">Age-appropriate activities for this learning area</p>
            </div>
            <div className="p-3 bg-white rounded-lg border border-pink-100">
              <p className="text-sm font-medium text-gray-700">Assessment</p>
              <p className="text-xs text-gray-500 mt-1">Developmental checklist criteria</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Developmental Milestones</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Age Range</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Area</th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Milestone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {ECE_MILESTONES.map((m, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs font-medium">{m.age}</span>
                </td>
                <td className="px-6 py-4 text-sm font-medium text-gray-700">{m.area}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{m.milestone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600">—</p>
          <p className="text-sm text-gray-500 mt-1">Enrolled ECE Learners</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600">—</p>
          <p className="text-sm text-gray-500 mt-1">ECE Teachers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600">6</p>
          <p className="text-sm text-gray-500 mt-1">Learning Areas</p>
        </div>
      </div>
    </div>
  );
}
