'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gradingSystemApi } from '@/lib/api';

const defaultEczGrades = [
  { grade: '1', points: 1, minScore: 75, maxScore: 100, description: 'Distinction' },
  { grade: '2', points: 2, minScore: 70, maxScore: 74, description: 'Distinction' },
  { grade: '3', points: 3, minScore: 65, maxScore: 69, description: 'Merit' },
  { grade: '4', points: 4, minScore: 60, maxScore: 64, description: 'Merit' },
  { grade: '5', points: 5, minScore: 55, maxScore: 59, description: 'Credit' },
  { grade: '6', points: 6, minScore: 50, maxScore: 54, description: 'Credit' },
  { grade: '7', points: 7, minScore: 45, maxScore: 49, description: 'Satisfactory' },
  { grade: '8', points: 8, minScore: 40, maxScore: 44, description: 'Satisfactory' },
  { grade: '9', points: 9, minScore: 0, maxScore: 39, description: 'Unsatisfactory' },
];

const defaultGpaGrades = [
  { grade: 'A+', points: 4.0, minScore: 90, maxScore: 100, description: 'Exceptional' },
  { grade: 'A', points: 4.0, minScore: 80, maxScore: 89, description: 'Excellent' },
  { grade: 'A-', points: 3.7, minScore: 75, maxScore: 79, description: 'Very Good' },
  { grade: 'B+', points: 3.3, minScore: 70, maxScore: 74, description: 'Good' },
  { grade: 'B', points: 3.0, minScore: 65, maxScore: 69, description: 'Above Average' },
  { grade: 'B-', points: 2.7, minScore: 60, maxScore: 64, description: 'Average' },
  { grade: 'C+', points: 2.3, minScore: 55, maxScore: 59, description: 'Below Average' },
  { grade: 'C', points: 2.0, minScore: 50, maxScore: 54, description: 'Satisfactory' },
  { grade: 'D', points: 1.0, minScore: 40, maxScore: 49, description: 'Poor' },
  { grade: 'F', points: 0.0, minScore: 0, maxScore: 39, description: 'Fail' },
];

type GradeEntry = {
  grade: string;
  points: number;
  minScore: number;
  maxScore: number;
  description: string;
};

export default function GradingPage() {
  const queryClient = useQueryClient();
  const [systemName, setSystemName] = useState('ECZ Point System');
  const [isDefault, setIsDefault] = useState(true);
  const [grades, setGrades] = useState<GradeEntry[]>(defaultEczGrades);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await gradingSystemApi.create({
        name: systemName,
        scales: grades.map(g => ({
          minScore: g.minScore,
          maxScore: g.maxScore,
          grade: g.grade,
          remark: g.description,
          points: g.points,
        })),
      });
      
      if (isDefault && result?.data?.data?.id) {
        await gradingSystemApi.setDefault(result.data.data.id);
      }
      
      setMessage({ type: 'success', text: 'Grading system saved successfully!' });
      queryClient.invalidateQueries({ queryKey: ['grading-systems'] });
    } catch (error: any) {
      console.error('Save grading error:', error);
      setMessage({ type: 'error', text: error?.response?.data?.message || 'Failed to save grading system' });
    } finally {
      setLoading(false);
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReset = (type: 'ECZ' | 'GPA') => {
    setSystemName(type === 'ECZ' ? 'ECZ Point System' : 'GPA Grading System');
    setGrades(type === 'ECZ' ? defaultEczGrades : defaultGpaGrades);
  };

  const updateGrade = (index: number, field: keyof GradeEntry, value: string | number) => {
    const newGrades = [...grades];
    newGrades[index] = { ...newGrades[index], [field]: value };
    setGrades(newGrades);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grading System</h1>
          <p className="text-gray-600 mt-1">Configure grading scales and grade boundaries</p>
        </div>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">System Name</label>
            <input
              type="text"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., ECZ Point System"
            />
          </div>
          <div className="flex items-center pt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="font-medium">Set as Default System</span>
            </label>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <button
              onClick={() => handleReset('ECZ')}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Reset to ECZ
            </button>
            <button
              onClick={() => handleReset('GPA')}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Reset to GPA
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Grade</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Points</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Min Score</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Max Score</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((grade, index) => (
                <tr key={index} className="border-t">
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={grade.grade}
                      onChange={(e) => updateGrade(index, 'grade', e.target.value)}
                      className="w-20 px-2 py-1 border rounded text-center font-bold"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      step="0.1"
                      value={grade.points}
                      onChange={(e) => updateGrade(index, 'points', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={grade.minScore}
                      onChange={(e) => updateGrade(index, 'minScore', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="number"
                      value={grade.maxScore}
                      onChange={(e) => updateGrade(index, 'maxScore', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border rounded text-center"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      value={grade.description}
                      onChange={(e) => updateGrade(index, 'description', e.target.value)}
                      className="w-full px-2 py-1 border rounded"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Grading System'}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Grading System Guide:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>ECZ (Zambia):</strong> Uses points 1-9 where 1 is best. Grades 1-2 are Distinction, 3-4 Merit, 5-6 Credit, 7-8 Satisfactory, 9 Fail.</li>
          <li>• <strong>GPA:</strong> Standard 4.0 scale where 4.0 is highest. Used for international comparisons.</li>
          <li>• <strong>Points:</strong> Used for ranking (lower points = better in ECZ, higher = better in GPA).</li>
          <li>• <strong>Score Range:</strong> Must be contiguous (e.g., 0-39, 40-44, 45-49).</li>
        </ul>
      </div>
    </div>
  );
}
