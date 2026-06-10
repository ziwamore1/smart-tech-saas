'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { intelligenceApi, examApi } from '@/lib/api';
import RadarChart from '@/components/charts-echarts/RadarChart';
import ComparisonChart from '@/components/charts-echarts/ComparisonChart';
import TrendChart from '@/components/charts-echarts/TrendChart';

export default function ExamQualityPage() {
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const res = await examApi.getAll();
      const d = res.data?.data || res.data?.exams || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: quality, isLoading: qualityLoading } = useQuery({
    queryKey: ['exam-quality', selectedExam],
    queryFn: () => intelligenceApi.analyzeExamQuality(selectedExam).then(r => r.data?.data || r.data),
    enabled: !!selectedExam,
  });

  const { data: examComparison, isLoading: compareLoading } = useQuery({
    queryKey: ['exam-compare', selectedSubject],
    queryFn: () => intelligenceApi.compareExamsBySubject(selectedSubject).then(r => r.data?.data || r.data),
    enabled: !!selectedSubject,
  });

  const { data: gradeInflation, isLoading: inflationLoading } = useQuery({
    queryKey: ['grade-inflation', selectedSubject],
    queryFn: () => intelligenceApi.detectGradeInflation(selectedSubject).then(r => r.data?.data || r.data),
    enabled: !!selectedSubject,
  });

  const { data: blueprint, isLoading: blueprintLoading } = useQuery({
    queryKey: ['exam-blueprint', selectedExam],
    queryFn: () => intelligenceApi.getExamBlueprint(selectedExam).then(r => r.data?.data || r.data),
    enabled: !!selectedExam,
  });

  const qualityRadarIndicators = quality ? [
    { name: 'Validity', max: 100 },
    { name: 'Reliability', max: 100 },
    { name: 'Difficulty', max: 100 },
    { name: 'Discrimination', max: 100 },
    { name: 'Coverage', max: 100 },
  ] : [];

  const qualityRadarSeries = quality ? [{
    name: selectedExam ? 'Current Exam' : 'Exam',
    value: [
      quality.validityScore || 0,
      quality.reliabilityScore || 0,
      (quality.difficultyScore || 0),
      quality.discriminationScore || 0,
      quality.coverageScore || 0,
    ],
  }] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Exam Quality Analysis</h1>
        <p className="text-gray-600 mt-1">Evaluate exam quality, detect grade inflation, and analyze blueprints</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Exam to Analyze</label>
            <select value={selectedExam} onChange={(e) => setSelectedExam(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select Exam</option>
              {(exams || []).map((exam: any) => (
                <option key={exam.id} value={exam.id}>{exam.name || exam.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject Comparison</label>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="">Select Subject</option>
              {['mathematics', 'english', 'science', 'social-studies', 'integrated-science'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {quality && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { label: 'Overall Quality', value: quality.overallScore, color: 'text-orange-600' },
              { label: 'Validity', value: quality.validityScore, color: 'text-blue-600' },
              { label: 'Reliability', value: quality.reliabilityScore, color: 'text-green-600' },
              { label: 'Difficulty', value: quality.difficultyScore, color: 'text-purple-600' },
              { label: 'Discrimination', value: quality.discriminationScore, color: 'text-amber-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-lg shadow p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value?.toFixed(1) || 'N/A'}</div>
                <div className="text-xs text-gray-600 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {qualityRadarIndicators.length > 0 && (
            <RadarChart
              indicators={qualityRadarIndicators}
              series={qualityRadarSeries}
              title="Exam Quality Profile"
              loading={qualityLoading}
            />
          )}

          {quality.dimensions && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Quality Dimensions</h3>
              <div className="space-y-4">
                {Object.entries(quality.dimensions).map(([key, val]: [string, any]) => (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="font-semibold">{typeof val === 'number' ? val.toFixed(1) : String(val)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                        style={{ width: `${typeof val === 'number' ? val : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {gradeInflation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Grade Inflation Detection</h3>
            {gradeInflation.trends ? (
              <TrendChart
                lines={[
                  { name: 'Average Score', data: (gradeInflation.trends || []).map((t: any) => ({ label: t.year?.toString() || t.term, value: t.average || 0 })), color: '#ea6645' },
                  { name: 'Pass Rate', data: (gradeInflation.trends || []).map((t: any) => ({ label: t.year?.toString() || t.term, value: t.passRate || 0 })), color: '#3b82f6' },
                ]}
                title="Score Trends Over Time"
                loading={inflationLoading}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">No trend data</div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Inflation Indicators</h3>
            {gradeInflation.indicators ? (
              <div className="space-y-4">
                {Object.entries(gradeInflation.indicators).map(([key, val]: [string, any]) => (
                  <div key={key} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className={`font-semibold ${
                      typeof val === 'number' && val > 0.5 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {typeof val === 'number' ? val.toFixed(3) : String(val)}
                    </span>
                  </div>
                ))}
                <div className={`p-4 rounded-lg ${
                  gradeInflation.inflationDetected ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <p className={`text-sm font-medium ${
                    gradeInflation.inflationDetected ? 'text-red-800' : 'text-green-800'
                  }`}>
                    <i className={`fa fa-${gradeInflation.inflationDetected ? 'exclamation-triangle' : 'check-circle'} mr-2`}></i>
                    {gradeInflation.inflationDetected
                      ? 'Grade inflation may be present. Review assessment standards.'
                      : 'No significant grade inflation detected.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">No indicator data</div>
            )}
          </div>
        </div>
      )}

      {examComparison && (
        <ComparisonChart
          categories={(examComparison.exams || []).map((e: any) => e.name || e.title)}
          groups={[
            { name: 'Quality Score', values: (examComparison.exams || []).map((e: any) => e.qualityScore || 0), color: '#ea6645' },
            { name: 'Average Score', values: (examComparison.exams || []).map((e: any) => e.averageScore || 0), color: '#3b82f6' },
          ]}
          title="Exam Comparison by Subject"
          loading={compareLoading}
        />
      )}

      {blueprint && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Exam Blueprint Analysis</h3>
            <div className="space-y-3">
              {blueprint.topics?.map((topic: any, i: number) => (
                <div key={i} className="p-3 border border-gray-100 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">{topic.name}</span>
                    <span className="text-sm text-gray-500">{topic.weight}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-orange-500"
                      style={{ width: `${topic.weight}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{topic.questionCount || 0} questions</span>
                    <span>Bloom's: {topic.bloomsLevel || 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Bloom's Taxonomy Distribution</h3>
            {blueprint.bloomsDistribution ? (
              <ComparisonChart
                categories={Object.keys(blueprint.bloomsDistribution)}
                groups={[{
                  name: 'Questions',
                  values: Object.values(blueprint.bloomsDistribution),
                  color: '#8b5cf6',
                }]}
                title=""
                loading={blueprintLoading}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">No Bloom's data</div>
            )}
          </div>
        </div>
      )}

      {!quality && !gradeInflation && !examComparison && !blueprint && (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <i className="fa fa-clipboard-check text-5xl text-gray-300 mb-4"></i>
          <p className="text-lg">Select an exam or subject to analyze quality</p>
          <p className="text-sm mt-2">Evaluate exam design, detect grade inflation, and review blueprints</p>
        </div>
      )}
    </div>
  );
}
