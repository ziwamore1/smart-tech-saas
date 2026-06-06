'use client';

import { useState, useEffect } from 'react';

interface SuccessScreenProps {
  classCount: number;
  lessonCount: number;
  timeSaved: string;
  onDownload: () => void;
  onShare: () => void;
  onFinish: () => void;
}

export function SuccessScreen({ 
  classCount, 
  lessonCount, 
  timeSaved,
  onDownload, 
  onShare,
  onFinish 
}: SuccessScreenProps) {
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      {showConfetti && <Confetti />}
      
      <div className="max-w-lg w-full bg-white rounded-xl shadow-sm border p-8 text-center">
        <div className="text-6xl mb-4">🎉</div>
        
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Your timetable is ready!
        </h1>
        
        <p className="text-lg text-slate-600 mb-8">
          You just saved <span className="font-semibold text-green-600">{timeSaved}</span> of work.
        </p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Classes', value: classCount, icon: '🏫' },
            { label: 'Lessons', value: lessonCount, icon: '📚' },
            { label: 'Time Saved', value: timeSaved, icon: '⏱️' },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-50 rounded-lg p-4">
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
              <div className="text-xs text-slate-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-center gap-2 text-green-700">
            <span>✅</span>
            <span className="font-medium">No conflicts</span>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onDownload}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            📥 Download PDF
          </button>
          
          <button
            onClick={onShare}
            className="w-full py-3 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-100 flex items-center justify-center gap-2"
          >
            📤 Share with staff
          </button>
          
          <button
            onClick={onFinish}
            className="w-full py-2 text-slate-600 hover:text-slate-900"
          >
            Finish
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {particles.map(p => (
        <div
          key={p.id}
          className={`absolute w-3 h-3 ${p.color} rounded-full`}
          style={{
            left: `${p.x}%`,
            top: '-10px',
            animation: `confetti 2s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default SuccessScreen;