'use client';

import React from 'react';

interface LandingPageProps {
  onWatchDemo: () => void;
  onTryFree: () => void;
}

export function LandingPage({ onWatchDemo, onTryFree }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="text-xl font-bold text-gray-900">Smart Timetable</span>
        </div>
        <button
          onClick={onTryFree}
          className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Login
        </button>
      </nav>

      <section className="max-w-6xl mx-auto px-8 py-16 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            Create your school timetable in minutes, not days
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            The smart scheduling tool that saves teachers and administrators 20+ hours every term.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
            <button
              onClick={onTryFree}
              className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
            >
              Try for Free
            </button>
            <button
              onClick={onWatchDemo}
              className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 text-lg font-semibold rounded-xl hover:border-gray-300 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-xl">▶</span>
              Watch Demo
            </button>
          </div>

          <div className="flex flex-col gap-3 text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>No technical skills needed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Works for any school size</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              <span>Instant timetable generation</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full max-w-xl">
          <DemoPreview />
        </div>
      </section>
    </div>
  );
}

function DemoPreview() {
  return (
    <div className="bg-gray-100 rounded-xl p-4 shadow-lg">
      <div className="bg-white rounded-lg border p-4">
        <div className="text-center text-sm font-medium text-gray-500 mb-3">
          Grade 9A - Sample Timetable
        </div>
        <div className="grid grid-cols-6 gap-1 text-xs">
          <div />
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => (
            <div key={d} className="text-center font-medium text-gray-500 py-1">{d}</div>
          ))}
          {[1,2,3,4,5,6,7].map(p => (
            <React.Fragment key={p}>
              <div className="text-center text-gray-400 py-2">{p}</div>
              {[0,1,2,3,4].map(d => (
                <div key={`${p}-${d}`} className={`py-2 rounded text-center ${
                  p <= 3 ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-100'
                }`}>
                  {p === 1 && d === 0 && 'Math'}
                  {p === 2 && d === 0 && 'English'}
                  {p === 3 && d === 0 && 'Physics'}
                  {p === 1 && d === 1 && 'History'}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LandingPage;