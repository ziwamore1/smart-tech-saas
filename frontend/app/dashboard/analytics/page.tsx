'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AnalyticsPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard/analytics-enhanced');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-6 max-w-lg mx-auto p-8">
        <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
          <span className="text-4xl">📊</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics has moved</h1>
          <p className="text-gray-600">
            The enhanced analytics dashboard with ECharts-powered visualizations, 
            heatmaps, radar charts, box plots, cohort analysis, and more is now the default.
          </p>
        </div>

        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-800">
          Redirecting to Enhanced Analytics in {countdown} second{countdown !== 1 ? 's' : ''}...
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/analytics-enhanced"
            className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-semibold"
          >
            Go to Enhanced Analytics
          </Link>
          <Link
            href="/dashboard/result-analytics"
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
          >
            Try Result Analytics
          </Link>
        </div>

        <p className="text-sm text-gray-500">
          Also see: <Link href="/dashboard/teacher-performance" className="text-blue-600 underline">Teacher Performance</Link>
        </p>
      </div>
    </div>
  );
}
