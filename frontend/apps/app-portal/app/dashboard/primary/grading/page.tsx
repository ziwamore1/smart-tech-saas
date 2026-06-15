'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { primaryGradingApi } from '@/lib/api';
import Link from 'next/link';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradOrange = 'linear-gradient(135deg, #f97316, #ea580c)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';

interface GradingScale {
  id: string;
  minScore: number;
  maxScore: number;
  grade: string;
  remark: string;
  points: number | null;
  gpa: number | null;
  color: string | null;
  sortOrder: number;
}

interface GradingPolicy {
  id: string;
  name: string;
  code: string;
  type: string;
  isDefault: boolean;
  active: boolean;
  description: string | null;
  scales: GradingScale[];
}

function GradeBar({ minScore, maxScore, grade, remark, points }: GradingScale & { policyType: string }) {
  const width = maxScore - minScore;
  const left = minScore;
  const getBarColor = (g: string) => {
    if (g === 'A' || g === '1') return '#059669';
    if (g === 'B' || g === '2' || g === '3') return '#3b82f6';
    if (g === 'C' || g === '4' || g === '5') return '#f59e0b';
    if (g === 'D' || g === '6' || g === '7') return '#f97316';
    return '#dc2626';
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: getBarColor(grade) }}>
        {grade}
      </div>
      <div className="flex-1">
        <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="absolute h-full rounded-full transition-all"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              background: getBarColor(grade),
              opacity: 0.7,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
            {minScore}% - {maxScore}%
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-600 w-40 text-right">{remark}</div>
      {points != null && <div className="text-sm font-semibold text-gray-700 w-12 text-right">{points} pts</div>}
    </div>
  );
}

export default function PrimaryGradingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [policies, setPolicies] = useState<GradingPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPolicy, setSelectedPolicy] = useState<GradingPolicy | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      loadPolicies();
    }
  }, [isAuthenticated, isLoading]);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const res = await primaryGradingApi.getPolicies();
      const data = res.data?.data || [];
      setPolicies(data);
      if (data.length > 0) setSelectedPolicy(data[0]);
    } catch (err: any) {
      setError('Failed to load grading policies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const defaultPolicy = policies.find(p => p.isDefault);
  const otherPolicies = policies.filter(p => !p.isDefault);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Primary School Grading</h1>
          <p className="text-sm text-gray-500 mt-1">
            Competency-based grading for Grades 1-4 and standard grading for Grades 5-6
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
            <i className="fas fa-info-circle text-orange-600 text-lg" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">About Primary Grading</h3>
            <p className="text-sm text-gray-600">
              Primary schools use a different grading system than secondary schools. 
              <strong> Grades 1-4 (Lower Primary)</strong> use competency-based grading (A-E) with descriptive remarks.
              <strong> Grades 5-6 (Upper Primary)</strong> use standard A-F grading. 
              The pass threshold is <strong>35%</strong> (compared to 50% in secondary).
              Grade 7 uses the ECZ national examination grading system.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
          <i className="fas fa-exclamation-circle" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-chart-line text-gray-400 text-2xl" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Grading Policies</h3>
          <p className="text-sm text-gray-500 mb-6">Grading policies will be created automatically when your school is provisioned.</p>
          <button onClick={loadPolicies} className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            <i className="fas fa-sync mr-2" /> Refresh
          </button>
        </div>
      ) : (
        <>
          {/* Default Policy */}
          {defaultPolicy && (
            <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
              <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <i className="fas fa-star text-emerald-600 text-sm" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-800">{defaultPolicy.name}</h2>
                    <span className="text-xs text-emerald-600 font-medium">Default Policy</span>
                  </div>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                  {defaultPolicy.code}
                </span>
              </div>
              <div className="p-6">
                <div className="text-sm text-gray-500 mb-4">
                  Applied to all classes unless overridden by a specific policy assignment
                </div>
                {defaultPolicy.scales
                  .sort((a, b) => b.maxScore - a.maxScore)
                  .map((scale) => (
                    <GradeBar key={scale.id} {...scale} policyType={defaultPolicy.type} />
                  ))}
              </div>
            </div>
          )}

          {/* Other Policies */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {otherPolicies.map((policy) => (
              <div
                key={policy.id}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden cursor-pointer transition-all ${
                  selectedPolicy?.id === policy.id ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 hover:border-orange-300'
                }`}
                onClick={() => setSelectedPolicy(policy)}
              >
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                      <i className="fas fa-table text-orange-600 text-xs" />
                    </div>
                    <span className="font-medium text-gray-800 text-sm">{policy.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {policy.code}
                    </span>
                    {policy.type === 'COMPETENCY' && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        Competency
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  {policy.scales
                    .sort((a, b) => b.maxScore - a.maxScore)
                    .map((scale) => (
                      <GradeBar key={scale.id} {...scale} policyType={policy.type} />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-balance-scale text-orange-500" />
                Primary vs Secondary Grading Comparison
              </h2>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Aspect</th>
                    <th className="text-left py-3 px-4 font-medium text-emerald-700 bg-emerald-50">Primary School</th>
                    <th className="text-left py-3 px-4 font-medium text-blue-700 bg-blue-50">Secondary School</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Scale</td>
                    <td className="py-3 px-4 text-gray-600">A (80-100%), B (65-79%), C (50-64%), D (35-49%), E/F (0-34%)</td>
                    <td className="py-3 px-4 text-gray-600">1-9 scale (ECZ), A-F (GPA), or custom</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Pass Mark</td>
                    <td className="py-3 px-4"><span className="text-emerald-600 font-semibold">35%</span></td>
                    <td className="py-3 px-4"><span className="text-blue-600 font-semibold">50%</span></td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Grade 1-4</td>
                    <td className="py-3 px-4 text-gray-600">Competency-based (A-E) with descriptive remarks</td>
                    <td className="py-3 px-4 text-gray-400">N/A</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Grade 5-6</td>
                    <td className="py-3 px-4 text-gray-600">Standard A-F grading</td>
                    <td className="py-3 px-4 text-gray-400">N/A</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">Grade 7</td>
                    <td className="py-3 px-4 text-gray-600">ECZ National Examination (separate system)</td>
                    <td className="py-3 px-4 text-gray-400">N/A</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-4 font-medium text-gray-700">GPA</td>
                    <td className="py-3 px-4 text-gray-600">4.0 scale (optional)</td>
                    <td className="py-3 px-4 text-gray-600">4.0 or 5.0 scale</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-medium text-gray-700">Assessment Types</td>
                    <td className="py-3 px-4 text-gray-600">Continuous Assessment, Term Tests, End of Term</td>
                    <td className="py-3 px-4 text-gray-600">Tests, Mid-Term, End of Term, Final Exam</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Manage Grading Systems Link */}
          <div className="flex justify-center">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <i className="fas fa-cog" />
              Manage Grading Settings
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
