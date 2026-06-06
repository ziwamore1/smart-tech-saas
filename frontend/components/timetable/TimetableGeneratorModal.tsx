"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classApi, timetableApi, api } from '@/lib/api';

type Props = {
  termId: string;
  onClose: () => void;
};

export default function TimetableGeneratorModal({ termId, onClose }: Props) {
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generating' | 'complete' | 'error'>('idle');

  const { data: classesData, isLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data),
  });

  const classes = classesData?.data || [];

  const { data: schoolConstraints } = useQuery({
    queryKey: ['school-constraints'],
    queryFn: async () => {
      try {
        const res = await api.get('/constraints/school');
        return res.data?.data || res.data;
      } catch { return null; }
    },
    retry: false,
  });

  const handleClassToggle = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSelectAll = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map((c: any) => c.id));
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('generating');

    try {
      const teacherConstraints = schoolConstraints ? {
        maxSubjectPerDay: schoolConstraints.maxSubjectPerDay,
        maxLessonsPerTeacherPerDay: schoolConstraints.maxLessonsPerTeacherPerDay,
      } : undefined;

      const targetClasses = selectedClasses.length === 0
        ? classes.map((c: any) => c.id)
        : selectedClasses;

      for (let i = 0; i < targetClasses.length; i++) {
        const clsId = targetClasses[i];
        try {
          await timetableApi.generateTimetable(clsId, termId, teacherConstraints);
        } catch (e) {
          console.error(`Failed to generate for class ${clsId}:`, e);
        }
        setGenerationProgress(Math.round(((i + 1) / targetClasses.length) * 100));
      }

      setGenerationProgress(100);
      setGenerationStatus('complete');
      setIsGenerating(false);

    } catch (error) {
      setGenerationStatus('error');
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Timetable Generator</h2>
              <p className="text-green-100 mt-1">AI-powered automatic timetable generation</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6">
          {generationStatus === 'generating' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Generating timetable...</span>
                <span className="text-sm font-medium text-green-600">{generationProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mt-2">
                This may take a few minutes. Please wait...
              </p>
            </div>
          )}

          {generationStatus === 'complete' && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-medium text-green-900">Generation Complete!</div>
                  <p className="text-sm text-green-700">Your timetable has been generated successfully.</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700">
                Select Classes to Generate
              </label>
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">Loading classes...</div>
              ) : classes.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No classes found.</div>
              ) : (
                <div className="divide-y">
                  {classes.map((cls: any) => (
                    <label
                      key={cls.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClasses.includes(cls.id)}
                        onChange={() => handleClassToggle(cls.id)}
                        className="rounded text-green-600"
                      />
                      <span className="font-medium text-gray-900">{cls.name}</span>
                      <span className="text-sm text-gray-500 ml-auto">
                        {selectedClasses.includes(cls.id) ? 'Will generate' : 'Skipped'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-2 text-sm text-gray-500">
              {selectedClasses.length} of {classes.length} classes selected
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <div className="font-medium text-blue-900">AI Generation Tips</div>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• Make sure you have defined lesson requirements for each class</li>
                  <li>• Set up teacher availability constraints if needed</li>
                  <li>• The AI will try to minimize teacher overtime and conflicts</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-lg hover:bg-gray-100 transition"
          >
            {generationStatus === 'complete' ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || generationStatus === 'complete'}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="animate-spin">⟳</span>
                Generating...
              </>
            ) : (
              <>
                <span>⚡</span>
                {selectedClasses.length === 0 ? 'Generate All' : `Generate (${selectedClasses.length})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
