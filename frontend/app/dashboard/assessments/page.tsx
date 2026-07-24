'use client';

import { useEffect, useState } from 'react';

export default function AssessmentsPage() {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/dashboard/assessment-entry';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Assessment Entry</h1>
          <p className="text-gray-600 mt-1">Enter student scores for different assessment types</p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-8">
        <div className="flex items-start gap-4">
          <div className="text-4xl">⚠️</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-amber-900 mb-2">Page Deprecated</h2>
            <p className="text-amber-700 mb-4">
              This legacy score entry page has been replaced with an enhanced version that includes
              better validation, auto-save, batch entry, and grading engine integration.
            </p>
            <div className="bg-white rounded-lg border border-amber-200 p-4 mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">New Features in Assessment Entry:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Auto-save scores as you type</li>
                <li>• Batch entry for all assessment types at once</li>
                <li>• Real-time grade calculation</li>
                <li>• Import scores from Excel</li>
                <li>• Grading engine integration</li>
                <li>• Progress tracking per student</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <a
                href="/dashboard/assessment-entry"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Go to Assessment Entry →
              </a>
              <a
                href="/dashboard/results"
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                Results Management
              </a>
            </div>
            <p className="text-sm text-amber-600 mt-3">
              Redirecting automatically in {countdown} seconds...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
