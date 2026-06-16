'use client';

import Link from 'next/link';

export default function AiAnalyticsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fa fa-robot text-3xl text-purple-600"></i>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">AI Analytics</h1>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          AI-powered performance insights and predictive analytics. This feature is coming soon.
        </p>
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
        >
          <i className="fa fa-arrow-left"></i>
          Back to Analytics
        </Link>
      </div>
    </div>
  );
}
