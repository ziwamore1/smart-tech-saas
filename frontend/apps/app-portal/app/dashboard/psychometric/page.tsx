'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { intelligenceApi, examApi } from '@/lib/api';
import DistributionCurve from '@/components/charts-echarts/DistributionCurve';
import BoxPlotChart from '@/components/charts-echarts/BoxPlotChart';

export default function PsychometricPage() {
  const [selectedExam, setSelectedExam] = useState('');

  const { data: exams } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const res = await examApi.getAll();
      const d = res.data?.data || res.data?.exams || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: itemAnalysis, isLoading: itemLoading } = useQuery({
    queryKey: ['item-analysis', selectedExam],
    queryFn: () => intelligenceApi.getItemAnalysis(selectedExam).then(r => r.data?.data || r.data),
    enabled: !!selectedExam,
  });

  const { data: reliability, isLoading: reliabilityLoading } = useQuery({
    queryKey: ['exam-reliability', selectedExam],
    queryFn: () => intelligenceApi.getExamReliability(selectedExam).then(r => r.data?.data || r.data),
    enabled: !!selectedExam,
  });

  const { data: difficulty, isLoading: difficultyLoading } = useQuery({
    queryKey: ['difficulty-distribution', selectedExam],
    queryFn: () => intelligenceApi.getDifficultyDistribution(selectedExam).then(r => r.data?.data || r.data),
    enabled: !!selectedExam,
  });

  const { data: scoreDist, isLoading: scoreLoading } = useQuery({
    queryKey: ['score-distribution', selectedExam],
    queryFn: () => intelligenceApi.getScoreDistribution(selectedExam).then(r => r.data?.data || r.data),
    enabled: !!selectedExam,
  });

  const boxPlotData = difficulty?.difficultyLevels ? [
    { name: 'Difficulty', min: 0, q1: 25, median: 50, q3: 75, max: 100 },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Psychometric Analysis</h1>
        <p className="text-gray-600 mt-1">Exam reliability, item analysis, and score distribution</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Exam</label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Choose an exam to analyze</option>
            {(exams || []).map((exam: any) => (
              <option key={exam.id} value={exam.id}>{exam.name || exam.title}</option>
            ))}
          </select>
        </div>
      </div>

      {reliability && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className={`text-3xl font-bold ${(reliability.cronbachAlpha || 0) >= 0.7 ? 'text-green-600' : 'text-orange-600'}`}>
              {reliability.cronbachAlpha?.toFixed(3) || 'N/A'}
            </div>
            <div className="text-sm text-gray-600 mt-1">Cronbach's Alpha</div>
            <div className="text-xs text-gray-400 mt-1">
              {reliability.cronbachAlpha >= 0.9 ? 'Excellent' : reliability.cronbachAlpha >= 0.8 ? 'Good' : reliability.cronbachAlpha >= 0.7 ? 'Acceptable' : 'Poor'}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{reliability.splitHalf?.toFixed(3) || 'N/A'}</div>
            <div className="text-sm text-gray-600 mt-1">Split-Half Reliability</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">{reliability.itemCount || 'N/A'}</div>
            <div className="text-sm text-gray-600 mt-1">Total Items</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-amber-600">{reliability.eliminationCount || 0}</div>
            <div className="text-sm text-gray-600 mt-1">Items to Eliminate</div>
          </div>
        </div>
      )}

      {itemAnalysis?.items && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Item Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3">Item</th>
                  <th className="text-center py-2 px-3">Difficulty</th>
                  <th className="text-center py-2 px-3">Discrimination</th>
                  <th className="text-center py-2 px-3">Point-Biserial</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {itemAnalysis.items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">Q{item.itemNumber || i + 1}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.difficulty < 0.3 ? 'bg-green-100 text-green-700' :
                        item.difficulty < 0.7 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.difficulty?.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`font-medium ${
                        (item.discrimination || 0) >= 0.4 ? 'text-green-600' :
                        (item.discrimination || 0) >= 0.2 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {item.discrimination?.toFixed(3)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">{item.pointBiserial?.toFixed(3) || 'N/A'}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.flag === 'good' ? 'bg-green-100 text-green-700' :
                        item.flag === 'review' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.flag || 'good'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {difficulty && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Difficulty Distribution</h3>
            {difficulty.distribution ? (
              <DistributionCurve
                data={(difficulty.distribution || []).map((d: any, i: number) => ({
                  value: typeof d === 'number' ? i * 10 : (d.score || d.value || i * 10),
                  frequency: typeof d === 'number' ? d : (d.count || d.frequency || 0),
                }))}
                mean={difficulty.meanDifficulty}
                stdDev={difficulty.stdDevDifficulty}
                loading={difficultyLoading}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">No distribution data</div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Difficulty Levels</h3>
            {difficulty.levels ? (
              <div className="space-y-4">
                {Object.entries(difficulty.levels).map(([level, count]: [string, any]) => (
                  <div key={level}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize text-gray-700">{level}</span>
                      <span className="font-semibold">{count} items</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="h-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                        style={{ width: `${(count / difficulty.totalItems) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">No level data</div>
            )}
          </div>
        </div>
      )}

      {scoreDist && (
        <DistributionCurve
          data={((scoreDist.histogram || scoreDist.distribution || []) as any[]).map((d: any) => ({
            value: d.score || d.value || 0,
            frequency: d.count || d.frequency || 0,
          }))}
          mean={scoreDist.mean}
          stdDev={scoreDist.stdDev}
          title="Score Distribution"
          loading={scoreLoading}
        />
      )}
    </div>
  );
}
