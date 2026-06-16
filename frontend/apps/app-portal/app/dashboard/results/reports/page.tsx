'use client';

import Link from 'next/link';

export default function ResultReportsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fa fa-chart-bar text-3xl text-blue-600"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Result Reports</h1>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Comprehensive result analysis and reporting. This feature is coming soon.
        </p>
        <Link
          href="/dashboard/results"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          <i className="fa fa-arrow-left"></i>
          Back to Results
        </Link>
      </div>
    </div>
  );
}
