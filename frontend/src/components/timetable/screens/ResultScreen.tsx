'use client';

import { useState } from 'react';

interface ResultScreenProps {
  schedule: any[];
  conflicts: number;
  score: number;
  onFix: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onImprove: () => void;
}

export function ResultScreen({ 
  schedule, 
  conflicts, 
  score, 
  onFix, 
  onEdit, 
  onDownload,
  onImprove 
}: ResultScreenProps) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {conflicts > 0 ? (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-medium text-red-800">{conflicts} conflicts found</h3>
                <p className="text-sm text-red-600">Some lessons are overlapping</p>
              </div>
            </div>
            <button
              onClick={onFix}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Fix Automatically
            </button>
          </div>
        ) : (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="font-medium text-green-800">Timetable Generated!</h3>
                <p className="text-sm text-green-600">No conflicts found</p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${score >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
              {score}%
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-medium text-slate-500">Period</th>
                  {days.map(day => (
                    <th key={day} className="text-center p-3 text-sm font-medium text-slate-500">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4,5,6,7].map(period => (
                  <tr key={period} className="border-b">
                    <td className="p-3 text-sm text-slate-500 font-medium">{period}</td>
                    {days.map((_, dayIdx) => {
                      const lesson = schedule.find(s => s.day === dayIdx && s.period === period);
                      return (
                        <td key={dayIdx} className="p-2">
                          {lesson ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                              <div className="text-sm font-medium text-blue-900">{lesson.subject}</div>
                              <div className="text-xs text-blue-600">{lesson.teacher}</div>
                            </div>
                          ) : <div className="h-full min-h-[60px]" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={onEdit} className="px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100">
            ✏️ Edit
          </button>
          <button onClick={onImprove} className="px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100">
            📈 Improve
          </button>
          <button onClick={onDownload} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            📥 Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResultScreen;