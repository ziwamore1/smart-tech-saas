"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { classApi, subjectApi, teacherApi, timetableApi } from '@/lib/api';

type Props = {
  termId: string;
  onClose: () => void;
  onComplete: () => void;
};

type WizardStep = 'welcome' | 'basics' | 'structure' | 'lessons' | 'generation' | 'complete';

export default function TimetableWizardModal({ termId, onClose, onComplete }: Props) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data?.data || res.data || []),
  });

  const classes = classesData || [];

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(res => res.data?.data || res.data || []),
  });

  const subjects = subjectsData || [];

const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const res = await teacherApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const teachers = teachersData || [];

  const handleGenerate = async () => {
    setIsProcessing(true);
    try {
      await timetableApi.generateAllClasses(termId);
      setStep('complete');
    } catch (error) {
      alert('Failed to start generation. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const steps = [
    { key: 'welcome', label: 'Welcome', icon: '👋' },
    { key: 'basics', label: 'Basics', icon: '📋' },
    { key: 'structure', label: 'Structure', icon: '🏗️' },
    { key: 'lessons', label: 'Lessons', icon: '📚' },
    { key: 'generation', label: 'Generation', icon: '⚙️' },
    { key: 'complete', label: 'Complete', icon: '✅' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Timetable Wizard</h2>
              <p className="text-purple-100 mt-1">Step-by-step guide to create your timetable</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 mt-6">
            {steps.map((s, index) => (
              <div key={s.key} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                    index <= currentStepIndex
                      ? 'bg-white text-purple-600'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span>{s.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-8 h-0.5 mx-1 ${
                    index < currentStepIndex ? 'bg-white' : 'bg-white/30'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'welcome' && (
            <WelcomeStep onNext={() => setStep('basics')} />
          )}

          {step === 'basics' && (
            <BasicsStep
              classes={classes}
              onBack={() => setStep('welcome')}
              onNext={() => setStep('structure')}
            />
          )}

          {step === 'structure' && (
            <StructureStep
              onBack={() => setStep('basics')}
              onNext={() => setStep('lessons')}
            />
          )}

          {step === 'lessons' && (
            <LessonsStep
              classes={classes}
              subjects={subjects}
              teachers={teachers}
              onBack={() => setStep('structure')}
              onNext={() => setStep('generation')}
            />
          )}

          {step === 'generation' && (
            <GenerationStep
              onBack={() => setStep('lessons')}
              onGenerate={handleGenerate}
              isProcessing={isProcessing}
            />
          )}

          {step === 'complete' && (
            <CompleteStep onFinish={onComplete} />
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 mx-auto mb-6 bg-purple-100 rounded-full flex items-center justify-center">
        <span className="text-5xl">🪄</span>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        Welcome to Timetable Wizard
      </h3>
      <p className="text-gray-600 max-w-lg mx-auto mb-8">
        This wizard will guide you through creating a perfect timetable for your school.
        We'll help you set up your timetable structure, add lessons, and generate an optimized schedule.
      </p>
      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-3xl mb-2">📋</div>
          <div className="font-medium text-gray-900">Step 1: Basics</div>
          <div className="text-sm text-gray-500">Set up your timetable basics</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-3xl mb-2">📚</div>
          <div className="font-medium text-gray-900">Step 2: Lessons</div>
          <div className="text-sm text-gray-500">Define your lessons</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-3xl mb-2">⚡</div>
          <div className="font-medium text-gray-900">Step 3: Generate</div>
          <div className="text-sm text-gray-500">Create timetable automatically</div>
        </div>
      </div>
      <button
        onClick={onNext}
        className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium"
      >
        Get Started →
      </button>
    </div>
  );
}

function BasicsStep({
  classes,
  onBack,
  onNext,
}: {
  classes: any[];
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Basic Setup</h3>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <div className="font-medium text-blue-900">Tip</div>
            <p className="text-sm text-blue-700">
              We've pre-configured your timetable based on your school's settings.
              You can adjust these settings below or proceed with the defaults.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Teaching Days per Week
          </label>
          <select className="w-full px-4 py-2 border rounded-lg">
            <option>5 days (Monday - Friday)</option>
            <option>6 days (Monday - Saturday)</option>
            <option>7 days (All week)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Periods per Day
          </label>
          <select className="w-full px-4 py-2 border rounded-lg">
            <option>8 periods</option>
            <option>7 periods</option>
            <option>9 periods</option>
            <option>10 periods</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Period Duration
          </label>
          <select className="w-full px-4 py-2 border rounded-lg">
            <option>45 minutes</option>
            <option>40 minutes</option>
            <option>35 minutes</option>
            <option>50 minutes</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Break Duration
          </label>
          <select className="w-full px-4 py-2 border rounded-lg">
            <option>15 minutes</option>
            <option>10 minutes</option>
            <option>20 minutes</option>
            <option>30 minutes</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Classes ({classes.length} found)
        </label>
        <div className="bg-gray-50 border rounded-lg p-4 max-h-48 overflow-y-auto">
          {classes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No classes found. Please add classes first.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {classes.map((cls: any) => (
                <div key={cls.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked readOnly className="rounded" />
                  <span>{cls.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function StructureStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Timetable Structure</h3>
      
      <div className="bg-gray-50 border rounded-lg p-4">
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🏗️</div>
          <p className="text-gray-600">
            Your timetable structure has been automatically configured based on your school's settings.
          </p>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-medium text-gray-700">
          Weekly Structure Preview
        </div>
        <div className="p-4">
          <div className="grid grid-cols-6 gap-4 text-center text-sm">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
              <div key={day}>
                <div className="font-medium text-gray-900 mb-2">{day}</div>
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((period) => (
                    <div
                      key={period}
                      className="bg-gray-200 rounded py-2 text-xs text-gray-500"
                    >
                      P{period}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function LessonsStep({
  classes,
  subjects,
  teachers,
  onBack,
  onNext,
}: {
  classes: any[];
  subjects: any[];
  teachers: any[];
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Define Lessons</h3>
      
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📚</span>
          <div>
            <div className="font-medium text-green-900">Lessons Summary</div>
            <p className="text-sm text-green-700">
              You can use the Lesson Wizard to define lessons for each class,
              or skip this step and use the AI generator to automatically create lessons.
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-100 px-4 py-3 font-medium text-gray-700">
          Existing Lessons
        </div>
        <div className="p-4">
          <p className="text-gray-500 text-center py-8">
            No lessons defined yet. Click "Lesson Wizard" in the toolbar to add lessons.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl mb-2">📊</div>
          <div className="font-medium text-gray-900">{classes.length}</div>
          <div className="text-sm text-gray-500">Classes</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl mb-2">📖</div>
          <div className="font-medium text-gray-900">{subjects.length}</div>
          <div className="text-sm text-gray-500">Subjects</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl mb-2">👨‍🏫</div>
          <div className="font-medium text-gray-900">{teachers.length}</div>
          <div className="text-sm text-gray-500">Teachers</div>
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          Skip & Continue →
        </button>
      </div>
    </div>
  );
}

function GenerationStep({
  onBack,
  onGenerate,
  isProcessing,
}: {
  onBack: () => void;
  onGenerate: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
        <span className="text-5xl">⚙️</span>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        Ready to Generate
      </h3>
      <p className="text-gray-600 max-w-lg mx-auto mb-8">
        Your timetable configuration is complete. Click the button below to start the AI-powered
        timetable generation process. This may take a few minutes depending on the number of classes.
      </p>

      <div className="bg-gray-50 rounded-lg p-6 max-w-md mx-auto mb-8">
        <div className="space-y-3 text-left">
          <div className="flex items-center gap-3">
            <span className="text-green-500">✓</span>
            <span className="text-gray-700">Timetable structure configured</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-500">✓</span>
            <span className="text-gray-700">Classes loaded</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-500">✓</span>
            <span className="text-gray-700">Subjects available</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-green-500">✓</span>
            <span className="text-gray-700">Teachers assigned</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={onBack}
          className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition"
          disabled={isProcessing}
        >
          ← Back
        </button>
        <button
          onClick={onGenerate}
          disabled={isProcessing}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
        >
          {isProcessing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⟳</span>
              Generating...
            </span>
          ) : (
            '🚀 Start Generation'
          )}
        </button>
      </div>
    </div>
  );
}

function CompleteStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
        <span className="text-5xl">🎉</span>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-4">
        Timetable Generated Successfully!
      </h3>
      <p className="text-gray-600 max-w-lg mx-auto mb-8">
        Your timetable has been generated and is ready to use. You can now view it,
        make manual adjustments, or export it.
      </p>

      <div className="flex justify-center gap-4">
        <button
          onClick={onFinish}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
        >
          ✓ View Timetable
        </button>
      </div>
    </div>
  );
}
