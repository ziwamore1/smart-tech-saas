'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, termApi, classApi } from '@/lib/api';
import EduPageMasterTimetable from '@/components/timetable/EduPageMasterTimetable';
import TimetableWizardModal from '@/components/timetable/TimetableWizardModal';
import TimetableGeneratorModal from '@/components/timetable/TimetableGeneratorModal';
import LessonWizardModal from '@/components/timetable/LessonWizardModal';

export default function ClassViewPage() {
  const [selectedClass, setSelectedClass] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [showLessonWizard, setShowLessonWizard] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  const { data: schoolData } = useQuery({
    queryKey: ['school'],
    queryFn: () => schoolApi.getProfile(),
  });

  const { data: termData } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => {
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    }),
    enabled: !!schoolData?.data?.id,
  });

  const schoolId = schoolData?.data?.id;
  const termId = termData?.data?.id;
  const classes = Array.isArray(classesData) ? classesData : [];

  if (!schoolId || !termId) {
    return (
      <main className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Class View</h1>
          <p className="text-gray-500">Loading school data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Timetables</h1>
          <p className="text-sm text-gray-500">View and manage individual class schedules</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
            >
              <option value="">-- Select a class --</option>
              {classes.map((cls: any) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowLessonWizard(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Lesson Wizard
            </button>
            <button
              onClick={() => setShowGenerator(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {selectedClass ? (
        <EduPageMasterTimetable entityType="class" entityId={selectedClass} termId={termId} />
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">🏫</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Class</h3>
          <p className="text-gray-500">
            Choose a class from the dropdown above to view its timetable
          </p>
        </div>
      )}

      {showGenerator && (
        <TimetableGeneratorModal
          termId={termId}
          onClose={() => setShowGenerator(false)}
        />
      )}

      {showLessonWizard && (
        <LessonWizardModal
          termId={termId}
          onClose={() => setShowLessonWizard(false)}
        />
      )}

      {showWizard && (
        <TimetableWizardModal
          termId={termId}
          onClose={() => setShowWizard(false)}
          onComplete={() => setShowWizard(false)}
        />
      )}
    </main>
  );
}
