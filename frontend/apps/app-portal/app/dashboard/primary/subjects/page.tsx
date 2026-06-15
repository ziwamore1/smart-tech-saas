'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi } from '@/lib/api';

const PRIMARY_SUBJECTS_BY_GRADE: Record<string, string[]> = {
  'Pre': ['Language & Literacy', 'Numeracy', 'Creative Arts', 'Psychomotor', 'Social & Emotional'],
  '1': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education'],
  '2': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education'],
  '3': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education'],
  '4': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education'],
  '5': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education', 'Technology Studies'],
  '6': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education', 'Technology Studies'],
  '7': ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education', 'Creative Arts', 'Physical Education', 'Technology Studies'],
};

const ECZ_EXAMINABLE_SUBJECTS = ['English', 'Mathematics', 'Science', 'Social Studies', 'Zambian Language', 'Religious Education'];

export default function PrimarySubjectsPage() {
  const queryClient = useQueryClient();
  const [selectedGrade, setSelectedGrade] = useState<string>('1');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: '', code: '', grade: '1', isExam: false });

  const { data: subjects } = useQuery({
    queryKey: ['primary-subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const addMutation = useMutation({
    mutationFn: (data: any) => subjectApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['primary-subjects'] });
      setShowAddForm(false);
    },
  });

  const gradeSubjects = PRIMARY_SUBJECTS_BY_GRADE[selectedGrade] || [];
  const existingSubjects = (subjects || []).filter((s: any) => s.grade === selectedGrade || !s.grade);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Primary Subjects</h1>
          <p className="text-gray-500 text-sm mt-1">Zambian Primary Curriculum — Literacy, Numeracy, Science, and more</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2"
        >
          <i className="fas fa-plus" />
          Add Subject
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.keys(PRIMARY_SUBJECTS_BY_GRADE).map(grade => (
          <button
            key={grade}
            onClick={() => setSelectedGrade(grade)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-all ${
              selectedGrade === grade
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {grade === 'Pre' ? 'Pre-School' : `Grade ${grade}`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Subjects — {selectedGrade === 'Pre' ? 'Pre-School' : `Grade ${selectedGrade}`}
              </h2>
            </div>
            {gradeSubjects.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No subjects defined for this grade.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {gradeSubjects.map((subject, idx) => {
                  const isECZ = ECZ_EXAMINABLE_SUBJECTS.includes(subject);
                  return (
                    <div key={idx} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 text-xs">
                          <i className="fas fa-book" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{subject}</p>
                          <p className="text-xs text-gray-500">
                            {isECZ ? 'ECZ Examinable' : 'Non-examinable'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isECZ && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">ECZ</span>
                        )}
                        <button className="text-blue-600 text-sm hover:text-blue-800">Configure</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-2">ECZ Examinable Subjects</h3>
            <p className="text-xs text-gray-500 mb-3">These subjects are examined in the Grade 7 ECZ national assessment.</p>
            <div className="space-y-2">
              {ECZ_EXAMINABLE_SUBJECTS.map(subj => (
                <div key={subj} className="flex items-center gap-2 text-sm text-gray-700">
                  <i className="fas fa-check-circle text-emerald-500 text-xs" />
                  {subj}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Learning Areas</h3>
            <p className="text-xs text-gray-500 mb-3">Subjects are grouped into key learning areas per the Zambian curriculum.</p>
            <div className="space-y-2">
              {[
                { area: 'Literacy & Languages', subjects: 'English, Zambian Languages' },
                { area: 'Numeracy & Mathematics', subjects: 'Mathematics' },
                { area: 'Science & Technology', subjects: 'Science, Technology Studies' },
                { area: 'Social Sciences', subjects: 'Social Studies, Religious Education' },
                { area: 'Creative & Expressive Arts', subjects: 'Creative Arts, Physical Education' },
              ].map(area => (
                <div key={area.area} className="p-2 rounded-lg bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{area.area}</p>
                  <p className="text-xs text-gray-500">{area.subjects}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Add Subject</h2>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                <input type="text" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="Subject name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                <input type="text" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g., ENG" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                <select value={newSubject.grade} onChange={e => setNewSubject(p => ({ ...p, grade: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  {Object.keys(PRIMARY_SUBJECTS_BY_GRADE).map(g => <option key={g} value={g}>{g === 'Pre' ? 'Pre-School' : `Grade ${g}`}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={newSubject.isExam} onChange={e => setNewSubject(p => ({ ...p, isExam: e.target.checked }))} className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">ECZ Examinable Subject</span>
              </label>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium">Cancel</button>
              <button
                onClick={() => addMutation.mutate(newSubject)}
                disabled={!newSubject.name || addMutation.isPending}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                Add Subject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
