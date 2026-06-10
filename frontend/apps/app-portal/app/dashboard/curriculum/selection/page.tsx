'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { curriculumApi, classApi, termApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function SelectionAnalyticsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'class' | 'district' | 'province' | 'school'>('class');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const res = await classApi.getAll(); return res.data?.data || res.data || []; },
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => { const res = await termApi.getAll(); return res.data?.data || res.data || []; },
  });

  const { data: classAnalysis, isLoading: classLoading } = useQuery({
    queryKey: ['selection-class', selectedClassId, selectedTermId],
    queryFn: async () => {
      if (!selectedClassId || !selectedTermId) return null;
      const res = await curriculumApi.analyzeClassSelection(selectedClassId, selectedTermId);
      return res.data?.data || res.data;
    },
    enabled: !!selectedClassId && !!selectedTermId,
  });

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile', user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await curriculumApi.getSchoolProfile(user.schoolId);
      return res.data?.data || res.data;
    },
    enabled: !!user?.schoolId,
  });

  const { data: districtData } = useQuery({
    queryKey: ['district-rankings', district, selectedTermId],
    queryFn: async () => {
      if (!district || !selectedTermId) return null;
      const res = await curriculumApi.getDistrictRankings(district, selectedTermId);
      return res.data?.data || res.data;
    },
    enabled: !!district && !!selectedTermId,
  });

  const { data: provinceData } = useQuery({
    queryKey: ['province-rankings', province, selectedTermId],
    queryFn: async () => {
      if (!province || !selectedTermId) return null;
      const res = await curriculumApi.getProvinceRankings(province, selectedTermId);
      return res.data?.data || res.data;
    },
    enabled: !!province && !!selectedTermId,
  });

  const tabs = [
    { id: 'class' as const, label: 'Class Analysis', icon: 'fa-users' },
    { id: 'district' as const, label: 'District Rankings', icon: 'fa-map-marker-alt' },
    { id: 'province' as const, label: 'Province Rankings', icon: 'fa-map' },
    { id: 'school' as const, label: 'School Profile', icon: 'fa-school' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Form 1 Selection Analytics</h1>
        <p className="text-gray-500 mt-1">Analyze Grade 7 student performance for secondary school selection placement.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className={`fas ${tab.icon}`} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'class' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="">Select Class</option>
                {(classes as any[])?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="">Select Term</option>
                {(terms as any[])?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {classLoading ? <div className="text-center py-12 text-gray-500">Loading...</div> : classAnalysis ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-500">Students</p>
                  <p className="text-2xl font-bold text-gray-900">{(classAnalysis as any).totalStudents || 0}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-500">Avg Score</p>
                  <p className="text-2xl font-bold text-gray-900">{(classAnalysis as any).averageScore?.toFixed(1) || '-'}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-500">Top Score</p>
                  <p className="text-2xl font-bold text-green-600">{(classAnalysis as any).topScore || '-'}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 text-center">
                  <p className="text-sm text-gray-500">Pass Rate</p>
                  <p className="text-2xl font-bold text-blue-600">{((classAnalysis as any).passRate * 100)?.toFixed(1) || '-'}%</p>
                </div>
              </div>

              {(classAnalysis as any).students?.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">#</th>
                        <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">Student</th>
                        <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Score</th>
                        <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Rank</th>
                        <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Eligible</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(classAnalysis as any).students.map((s: any, i: number) => (
                        <tr key={s.studentId || i} className="hover:bg-gray-50">
                          <td className="px-6 py-3 text-sm text-gray-500">{i + 1}</td>
                          <td className="px-6 py-3 font-medium text-gray-900">{s.firstName} {s.lastName}</td>
                          <td className="px-6 py-3 text-center font-mono">{s.totalScore?.toFixed(1) ?? '-'}</td>
                          <td className="px-6 py-3 text-center font-mono">{s.rank ?? '-'}</td>
                          <td className="px-6 py-3 text-center"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${s.isEligible ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{s.isEligible ? 'YES' : 'NO'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center text-gray-500">Select a class and term to view selection analysis.</div>
          )}
        </div>
      )}

      {activeTab === 'district' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District name (e.g. Lusaka)" className="border rounded-lg px-3 py-2" />
              <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="">Select Term</option>
                {(terms as any[])?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {districtData ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">School</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Total Students</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Avg Score</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Top Score</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Pass Rate</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(districtData as any[])?.map((s: any, i: number) => (
                    <tr key={s.schoolId || i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{s.schoolName || s.name}</td>
                      <td className="px-6 py-3 text-center">{s.totalStudents || 0}</td>
                      <td className="px-6 py-3 text-center font-mono">{s.averageScore?.toFixed(1) ?? '-'}</td>
                      <td className="px-6 py-3 text-center font-mono">{s.topScore ?? '-'}</td>
                      <td className="px-6 py-3 text-center">{s.passRate != null ? `${(s.passRate * 100).toFixed(1)}%` : '-'}</td>
                      <td className="px-6 py-3 text-center font-mono">{i + 1}</td>
                    </tr>
                  ))}
                  {(!districtData || (districtData as any[]).length === 0) && <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No data for this district.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center text-gray-500">Enter a district name and select a term.</div>
          )}
        </div>
      )}

      {activeTab === 'province' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Province name (e.g. Central)" className="border rounded-lg px-3 py-2" />
              <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="">Select Term</option>
                {(terms as any[])?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {provinceData ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-medium text-gray-500 uppercase">District</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Total Students</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Avg Score</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Top Score</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Pass Rate</th>
                    <th className="text-center px-6 py-3 text-sm font-medium text-gray-500 uppercase">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(provinceData as any[])?.map((d: any, i: number) => (
                    <tr key={d.district || i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{d.district || d.name}</td>
                      <td className="px-6 py-3 text-center">{d.totalStudents || 0}</td>
                      <td className="px-6 py-3 text-center font-mono">{d.averageScore?.toFixed(1) ?? '-'}</td>
                      <td className="px-6 py-3 text-center font-mono">{d.topScore ?? '-'}</td>
                      <td className="px-6 py-3 text-center">{d.passRate != null ? `${(d.passRate * 100).toFixed(1)}%` : '-'}</td>
                      <td className="px-6 py-3 text-center font-mono">{i + 1}</td>
                    </tr>
                  ))}
                  {(!provinceData || (provinceData as any[]).length === 0) && <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">No data for this province.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center text-gray-500">Enter a province name and select a term.</div>
          )}
        </div>
      )}

      {activeTab === 'school' && (
        <div className="space-y-4">
          {schoolProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">School Details</h2>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-medium">{(schoolProfile as any).name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium">{(schoolProfile as any).type || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">District</span><span className="font-medium">{(schoolProfile as any).district || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Province</span><span className="font-medium">{(schoolProfile as any).province || '-'}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Selection Profile</h2>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-gray-500">Min Entry Score</span><span className="font-mono font-medium">{(schoolProfile as any).minEntryScore ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Capacity</span><span className="font-mono font-medium">{(schoolProfile as any).capacity ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Total Applicants</span><span className="font-mono font-medium">{(schoolProfile as any).totalApplicants || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Selection Rate</span><span className="font-mono font-medium">{((schoolProfile as any).selectionRate * 100)?.toFixed(1) || '-'}%</span></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-12 text-center text-gray-500">School profile data will appear here once selection data is available.</div>
          )}
        </div>
      )}
    </div>
  );
}
