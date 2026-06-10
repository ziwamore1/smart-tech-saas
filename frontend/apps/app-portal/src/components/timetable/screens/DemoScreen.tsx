'use client';

import { useState, useEffect } from 'react';

interface DemoScreenProps {
  onCreateOwn: () => void;
}

export function DemoScreen({ onCreateOwn }: DemoScreenProps) {
  const [isGenerating, setIsGenerating] = useState(true);
  const [schedule, setSchedule] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSchedule(generateDemoSchedule());
      setIsGenerating(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const generateDemoSchedule = () => {
    const lessons: any[] = [];
    const subjects = [
      { name: 'Math', teacher: 'Mrs. Smith' },
      { name: 'English', teacher: 'Mr. Jones' },
      { name: 'Physics', teacher: 'Mrs. Wilson' },
      { name: 'Chemistry', teacher: 'Mr. Brown' },
      { name: 'Biology', teacher: 'Mrs. Davis' },
      { name: 'History', teacher: 'Mr. Miller' },
    ];

    let idx = 0;
    for (let day = 0; day < 5; day++) {
      for (let period = 0; period < 7; period++) {
        if (idx < subjects.length && period < 5) {
          lessons.push({ day, period, ...subjects[idx] });
          idx++;
        }
      }
    }
    return lessons;
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center">
        <div className="text-5xl mb-8 animate-pulse">⚡</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Creating your timetable...</h2>
        <div className="space-y-3 text-gray-600">
          <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 animate-pulse" /> Analyzing requirements...</div>
          <div className="flex items-center gap-2 opacity-50">Checking constraints...</div>
          <div className="flex items-center gap-2 opacity-50">Optimizing schedule...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h2 className="text-white font-bold text-lg">Demo School Timetable</h2>
                <p className="text-green-100 text-sm">Grade 9A • Generated instantly</p>
              </div>
            </div>
            <div className="text-right text-green-100">
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm">Conflicts</div>
            </div>
          </div>

          <div className="p-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-gray-500 font-medium p-2">Period</th>
                  {days.map(day => (
                    <th key={day} className="text-center text-gray-500 font-medium p-2">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5, 6, 7].map(period => (
                  <tr key={period}>
                    <td className="text-gray-500 font-medium p-2">{period}</td>
                    {days.map((day, dayIdx) => {
                      const lesson = schedule.find(l => l.day === dayIdx && l.period === period - 1);
                      return (
                        <td key={day} className="p-1">
                          {lesson ? (
                            <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-center">
                              <div className="text-sm font-medium text-blue-900">{lesson.name}</div>
                              <div className="text-xs text-blue-600">{lesson.teacher}</div>
                            </div>
                          ) : <div className="h-full min-h-[50px]" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onCreateOwn}
            className="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
          >
            Create My Own →
          </button>
        </div>
      </div>
    </div>
  );
}

export default DemoScreen;