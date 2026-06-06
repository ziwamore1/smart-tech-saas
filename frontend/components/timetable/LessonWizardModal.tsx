"use client";

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { classApi, subjectApi, teacherApi, timetableApi } from '@/lib/api';

type Props = {
  termId: string;
  onClose: () => void;
};

type LessonRequirement = {
  id?: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  lessonsPerWeek: number;
};

export default function LessonWizardModal({ termId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [requirements, setRequirements] = useState<LessonRequirement[]>([]);
  const [currentRequirement, setCurrentRequirement] = useState<Partial<LessonRequirement>>({
    subjectId: '',
    teacherId: '',
    lessonsPerWeek: 1,
  });
  const [isSaving, setIsSaving] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data),
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(res => res.data),
  });

  const { data: teachersData } = useQuery({
    queryKey: ['lesson-wizard-teachers'],
    queryFn: () => teacherApi.getAll().then(res => res.data),
  });

  const classes = classesData || [];
  const subjects = subjectsData || [];
  const teachers = teachersData || [];

  const addRequirement = () => {
    if (!currentRequirement.subjectId || !currentRequirement.teacherId || !selectedClass) {
      alert('Please fill in all fields');
      return;
    }

    setRequirements(prev => [
      ...prev,
      {
        classId: selectedClass,
        subjectId: currentRequirement.subjectId!,
        teacherId: currentRequirement.teacherId!,
        lessonsPerWeek: currentRequirement.lessonsPerWeek || 1,
      },
    ]);

    setCurrentRequirement({ subjectId: '', teacherId: '', lessonsPerWeek: 1 });
  };

  const removeRequirement = (index: number) => {
    setRequirements(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all(
        requirements.map(req =>
          timetableApi.createLessonRequirement({
            classId: req.classId,
            subjectId: req.subjectId,
            teacherId: req.teacherId,
            lessonsPerWeek: req.lessonsPerWeek,
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ['lesson-requirements'] });
      alert('Lesson requirements saved successfully!');
      onClose();
    } catch (error) {
      alert('Failed to save lesson requirements.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClassName = classes.find((c: any) => c.id === selectedClass)?.name || '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Lesson Wizard</h2>
              <p className="text-blue-100 mt-1">Define lessons and teacher assignments</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Class *
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setRequirements([]);
                }}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select a class</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            {selectedClass && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700">Adding lessons for:</div>
                <div className="font-bold text-blue-900 text-lg">{selectedClassName}</div>
              </div>
            )}
          </div>

          {selectedClass && (
            <>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-3 font-medium text-gray-700 flex items-center justify-between">
                  <span>Add New Lesson Requirement</span>
                  <span className="text-sm font-normal text-gray-500">
                    {requirements.length} added
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subject *
                      </label>
                      <select
                        value={currentRequirement.subjectId || ''}
                        onChange={(e) => setCurrentRequirement(prev => ({ ...prev, subjectId: e.target.value }))}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="">Select subject</option>
                        {subjects.map((subject: any) => (
                          <option key={subject.id} value={subject.id}>{subject.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teacher *
                      </label>
                      <select
                        value={currentRequirement.teacherId || ''}
                        onChange={(e) => setCurrentRequirement(prev => ({ ...prev, teacherId: e.target.value }))}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="">Select teacher (count: {teachers.length})</option>
                        {teachers.map((teacher: any, idx: number) => (
                          <option key={teacher.id} value={teacher.id}>
                            {idx}: {teacher.user ? `${teacher.user.firstName} ${teacher.user.lastName}` : 'NO USER - ' + JSON.stringify(teacher).slice(0,50)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Lessons per Week
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={currentRequirement.lessonsPerWeek || 1}
                        onChange={(e) => setCurrentRequirement(prev => ({ ...prev, lessonsPerWeek: parseInt(e.target.value) || 1 }))}
                        className="w-full px-4 py-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    onClick={addRequirement}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    + Add Lesson Requirement
                  </button>
                </div>
              </div>

              {requirements.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-3 font-medium text-gray-700">
                    New Requirements ({requirements.length})
                  </div>
                  <div className="divide-y">
                    {requirements.map((req, index) => {
                      const subject = subjects.find((s: any) => s.id === req.subjectId);
                      const teacher = teachers.find((t: any) => t.id === req.teacherId);
                      return (
                        <div key={index} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-6">
                            <div>
                              <div className="text-xs text-gray-500">Subject</div>
                              <div className="font-medium">{subject?.name || 'Unknown'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Teacher</div>
                              <div className="font-medium">
                                {teacher?.user?.firstName} {teacher?.user?.lastName}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Lessons/Week</div>
                              <div className="font-medium">{req.lessonsPerWeek}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeRequirement(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedClass && (
            <div className="text-center py-12 text-gray-500">
              Please select a class to add lesson requirements
            </div>
          )}
        </div>

        <div className="flex justify-between px-6 py-4 bg-gray-50 border-t">
          <div className="text-sm text-gray-500">
            {requirements.length > 0 && `${requirements.length} requirements ready to save`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || requirements.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : `Save ${requirements.length} Requirements`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}