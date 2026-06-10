'use client';

import { useState, useEffect } from 'react';

interface GenerationProgressScreenProps {
  onComplete: (success: boolean) => void;
}

export function GenerationProgressScreen({ onComplete }: GenerationProgressScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const phases = ['Analyzing requirements...', 'Scheduling lessons...', 'Optimizing...'];
    
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => onComplete(true), 500);
          return 100;
        }
        return p + 2;
      });
      
      if (progress < 33) setPhase(0);
      else if (progress < 66) setPhase(1);
      else setPhase(2);
    }, 100);

    return () => clearInterval(interval);
  }, [onComplete, progress]);

  const phases = ['Analyzing requirements...', 'Scheduling lessons...', 'Optimizing schedule...'];

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 animate-pulse">⚡</div>
          <h1 className="text-2xl font-bold text-slate-900">
            Creating your timetable...
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            This usually takes 10-20 seconds
          </p>
        </div>

        <div className="mb-8">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {phases.map((p, i) => (
            <div 
              key={p} 
              className={`flex items-center gap-2 text-sm ${
                i === phase ? 'text-slate-900 font-medium' : 'text-slate-500'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i < phase ? 'bg-green-500 text-white' : i === phase ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-200'
              }`}>
                {i < phase ? '✓' : ''}
              </span>
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GenerationProgressScreen;