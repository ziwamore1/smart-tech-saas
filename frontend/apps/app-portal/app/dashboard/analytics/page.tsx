'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { classApi } from '@/lib/api';
import { termApi } from '@/lib/api';
import PieChart from '@/components/charts/PieChart';
import LineChart from '@/components/charts/LineChart';
import BarChart from '@/components/charts/BarChart';
import Histogram from '@/components/charts/Histogram';
import Link from 'next/link';
import { ChartData, StudentResultsStats, SubscriptionStats } from '@/types/communication';

type ViewMode = 'overview' | 'results' | 'subscription' | 'performance';

export default function AnalyticsPage() {
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');

  const { data: classesResponse } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const classes = Array.isArray(classesResponse) ? classesResponse : [];

  const { data: termsResponse } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.terms) data = data.terms;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? data : [];
    },
  });

  const terms = Array.isArray(termsResponse) ? termsResponse : [];

  useEffect(() => {
    if (!selectedClass && classes.length > 0) setSelectedClass(classes[0].id);
    if (!selectedTerm && terms.length > 0) {
      setSelectedTerm(terms.find((term: any) => term.isCurrent)?.id || terms[0].id);
    }
  }, [classes, terms, selectedClass, selectedTerm]);

  const { data: pieData, isLoading: pieLoading } = useQuery<ChartData>({
    queryKey: ['pie-chart', selectedClass],
    queryFn: () => analyticsApi.getPieChartData(selectedClass || undefined).then(res => res.data),
  });

  const { data: lineData, isLoading: lineLoading } = useQuery<ChartData>({
    queryKey: ['line-chart', selectedClass],
    queryFn: () => analyticsApi.getLineChartData(selectedClass).then(res => res.data),
    enabled: !!selectedClass,
  });

  const { data: barData, isLoading: barLoading } = useQuery<ChartData>({
    queryKey: ['bar-chart', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getBarChartData(selectedClass, selectedTerm).then(res => res.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: histogramData, isLoading: histogramLoading } = useQuery<ChartData>({
    queryKey: ['histogram', selectedClass, selectedTerm],
    queryFn: () => analyticsApi.getHistogramData(selectedClass, selectedTerm).then(res => res.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: resultsStats, isLoading: resultsLoading } = useQuery<StudentResultsStats | null>({
    queryKey: ['results-stats', selectedTerm],
    queryFn: async () => {
      if (!selectedTerm) return null;
      try {
        const res = await analyticsApi.getStudentResultsStats(selectedTerm);
        return res.data?.data || res.data;
      } catch (error: any) {
        console.warn('Results stats error:', error.response?.data || error.message);
        return null;
      }
    },
    enabled: !!selectedTerm,
  });

  const { data: subscriptionStats, isLoading: subscriptionLoading } = useQuery<SubscriptionStats>({
    queryKey: ['subscription-stats'],
    queryFn: () => analyticsApi.getSubscriptionStats().then(res => res.data),
  });

  useEffect(() => {
    console.log('DEBUG resultsStats:', resultsStats);
    console.log('DEBUG selectedTerm:', selectedTerm);
    console.log('DEBUG resultsLoading:', resultsLoading);
  }, [resultsStats, selectedTerm, resultsLoading]);

  const viewModes: { key: ViewMode; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'results', label: 'Student Results', icon: '📝' },
    { key: 'subscription', label: 'Subscription', icon: '💳' },
    { key: 'performance', label: 'Performance', icon: '📈' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Statistics</h1>
        <p className="text-gray-600 mt-1">Comprehensive analytics and data visualizations</p>
      </div>

      {showUpgradeBanner && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)',
          border: '1px solid #5eead4',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
            }}>
              <i className="fa fa-chart-line"></i>
            </div>
            <div>
              <p style={{ fontWeight: 600, color: '#115e59', margin: 0, fontSize: '14px' }}>
                New: Enhanced Analytics Available
              </p>
              <p style={{ fontSize: '13px', color: '#0f766e', margin: 0 }}>
                Try our new ECharts-powered dashboards with heatmaps, radar charts, box plots, and more
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link
              href="/dashboard/analytics-enhanced"
              style={{
                padding: '8px 16px', background: '#14b8a6', color: 'white',
                borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <i className="fa fa-rocket"></i>
              Try It Now
            </Link>
            <button
              onClick={() => setShowUpgradeBanner(false)}
              style={{
                padding: '8px 12px', background: 'transparent',
                border: '1px solid #5eead4', borderRadius: '8px',
                cursor: 'pointer', color: '#0f766e', fontSize: '13px'
              }}
            >
              <i className="fa fa-times"></i>
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b">
        {viewModes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setViewMode(mode.key)}
            className={`px-4 py-3 font-medium transition-colors ${
              viewMode === mode.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mr-2">{mode.icon}</span>
            {mode.label}
          </button>
        ))}
      </div>

      {viewMode === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Filter Options</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All Classes</option>
                  {classes?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Term</option>
                  {terms?.map((term: any) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pieLoading ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                Loading...
              </div>
            ) : pieData && pieData.labels && pieData.datasets && pieData.datasets[0] ? (
              <PieChart data={pieData} title="Grade Distribution" />
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                Select a class to view grade distribution
              </div>
            )}

            {lineLoading ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                Loading...
              </div>
            ) : lineData && lineData.labels && lineData.datasets && lineData.datasets[0] ? (
              <LineChart data={lineData} title="Performance Trend" />
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                Select a class to view performance trends
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'results' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Student Results Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Class</option>
                  {classes?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Term</option>
                  {terms?.map((term: any) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {resultsLoading ? (
              <div className="text-center py-12">Loading...</div>
            ) : resultsStats?.overview ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {resultsStats.overview.totalExams}
                    </div>
                    <div className="text-sm text-gray-600">Total Exams</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {resultsStats.overview.passRate}%
                    </div>
                    <div className="text-sm text-gray-600">Pass Rate</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {resultsStats.overview.averageScore}
                    </div>
                    <div className="text-sm text-gray-600">Avg Score</div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-orange-600">
                      {resultsStats.overview.failedExams}
                    </div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {histogramLoading ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">Loading...</div>
                  ) : histogramData && histogramData.labels && histogramData.datasets && histogramData.datasets[0] ? (
                    <Histogram data={histogramData} title="Score Distribution" />
                  ) : (
                    <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                      Select class and term
                    </div>
                  )}

                  {barLoading ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">Loading...</div>
                  ) : barData && barData.labels && barData.datasets && barData.datasets[0] ? (
                    <BarChart data={barData} title="Subject Performance" />
                  ) : (
                    <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                      Select class and term
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
                    <div className="space-y-2">
                      {resultsStats.topPerformers.slice(0, 5).map((student, index) => (
                        <div key={student.studentId} className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {index + 1}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-gray-600">Avg: {student.average}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold mb-4">Areas for Improvement</h3>
                    <div className="space-y-2">
                      {resultsStats.improvementAreas.slice(0, 5).map((area) => (
                        <div key={area.subjectId} className="flex items-center gap-3">
                          <span className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="flex-1">
                            <div className="font-medium">{area.subject}</div>
                            <div className="text-sm text-gray-600">
                              Avg: {area.average}% | Pass: {area.passRate}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                Select class and term to view results
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'subscription' && (
        <div className="space-y-6">
          {subscriptionLoading ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">Loading...</div>
          ) : subscriptionStats && subscriptionStats.subscription ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-2xl font-bold text-blue-600">
                    {subscriptionStats.subscription?.plan || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Current Plan</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-2xl font-bold text-green-600">
                    {subscriptionStats?.students?.utilizationRate ?? 0}%
                  </div>
                  <div className="text-sm text-gray-600">Student Utilization</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-2xl font-bold text-purple-600">
                    {subscriptionStats?.payments?.collectionRate ?? 0}%
                  </div>
                  <div className="text-sm text-gray-600">Collection Rate</div>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="text-2xl font-bold text-orange-600">
                    {subscriptionStats?.payments?.pendingAmount ?? 0}
                  </div>
                  <div className="text-sm text-gray-600">Pending Amount</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Student Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Total Students</span>
                      <span className="font-semibold">{subscriptionStats.students.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Active</span>
                      <span className="font-semibold text-green-600">
                        {subscriptionStats.students.active}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Inactive</span>
                      <span className="font-semibold text-red-600">
                        {subscriptionStats.students.inactive}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Max Allowed</span>
                      <span className="font-semibold">
                        {subscriptionStats.subscription?.maxStudents || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Payment Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Total Revenue</span>
                      <span className="font-semibold text-green-600">
                        {subscriptionStats.payments.totalRevenue}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Paid Payments</span>
                      <span className="font-semibold">
                        {subscriptionStats.payments.paidCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Pending Payments</span>
                      <span className="font-semibold text-orange-600">
                        {subscriptionStats.payments.pendingCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {pieData && pieData.labels && pieData.datasets && pieData.datasets[0] ? (
                <PieChart data={pieData} title="Payment Status Distribution" />
              ) : null}
            </>
          ) : (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              Subscription data not available
            </div>
          )}
        </div>
      )}

      {viewMode === 'performance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Performance Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Class</option>
                  {classes?.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Term
                </label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Term</option>
                  {terms?.map((term: any) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {lineLoading ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">Loading...</div>
              ) : lineData && lineData.labels && lineData.datasets && lineData.datasets[0] ? (
                <LineChart data={lineData} title="Term-wise Performance Trend" />
              ) : (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                  Select class to view trends
                </div>
              )}

              {barLoading ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">Loading...</div>
              ) : barData && barData.labels && barData.datasets && barData.datasets[0] ? (
                <BarChart data={barData} title="Subject-wise Performance" />
              ) : (
                <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                  Select class and term
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
