'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolApi, termApi, academicYearApi, gradingSystemApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

type SettingsTab = 'school' | 'academic' | 'terms' | 'grading' | 'appearance' | 'notifications';

type GradeEntry = {
  grade: string;
  points: number;
  minScore: number;
  maxScore: number;
  description: string;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SettingsTab>('school');
  const [isEditing, setIsEditing] = useState(false);

  const { data: schoolData, isLoading: schoolLoading } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => schoolApi.getProfile().then(res => res.data),
  });

  const { data: termsData, isLoading: termsLoading } = useQuery({
    queryKey: ['terms'],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: academicYearsData, isLoading: academicYearsLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await academicYearApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const [schoolForm, setSchoolForm] = useState({
    name: '',
    registrationNumber: '',
    phone: '',
    email: '',
    address: '',
    motto: '',
    website: '',
  });

  const [academicYearForm, setAcademicYearForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  });

  const [termForm, setTermForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    academicYearId: '',
  });

  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [academicYearMessage, setAcademicYearMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [termMessage, setTermMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [gradingSystemCode, setGradingSystemCode] = useState<string>('SECONDARY_ECZ');

  const { data: timeSettings } = useQuery({
    queryKey: ['time-settings'],
    queryFn: () => schoolApi.getTimeSettings().then(res => res.data),
  });

  useEffect(() => {
    if (timeSettings?.gradingSystem) {
      setGradingSystemCode(timeSettings.gradingSystem);
    }
  }, [timeSettings]);

  const { data: gradingSystemsList } = useQuery({
    queryKey: ['grading-systems'],
    queryFn: () => gradingSystemApi.getAll().then((res: any) => {
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    }),
  });

  const codeToName: Record<string, string> = {
    PRIMARY_ECZ: 'ECZ Primary Grading System',
    SECONDARY_ECZ: 'ECZ Secondary Grading System',
    FORMS_ECZ: 'ECZ Forms Grading System',
    COLLEGE_GPA: 'College GPA Grading System',
    UNIVERSITY_CGPA: 'University CGPA Grading System',
  };

  const gradingSystemCodeToLabel: Record<string, string> = {
    PRIMARY_ECZ: 'ECZ Primary (Grade 7)',
    SECONDARY_ECZ: 'ECZ Secondary (Grade 9/12)',
    FORMS_ECZ: 'ECZ Forms (Competency)',
    COLLEGE_GPA: 'College GPA',
    UNIVERSITY_CGPA: 'University CGPA',
  };

  const selectedGradingSystem = gradingSystemsList?.find(
    (gs: any) => gs.name === codeToName[gradingSystemCode]
  );

  const [editableScales, setEditableScales] = useState<any[]>([]);

  useEffect(() => {
    if (selectedGradingSystem?.gradeScales) {
      setEditableScales(
        selectedGradingSystem.gradeScales.map((s: any) => ({
          grade: s.grade,
          points: s.points,
          minScore: s.minScore,
          maxScore: s.maxScore,
          description: s.remark,
        }))
      );
    }
  }, [selectedGradingSystem?.id]);

  const updateSchoolMutation = useMutation({
    mutationFn: (data: any) => schoolApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-profile'] });
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'School information saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    },
    onError: () => {
      setSaveMessage({ type: 'error', text: 'Failed to save school information' });
      setTimeout(() => setSaveMessage(null), 3000);
    },
  });

  const createTermMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string; academicYearId: string }) => termApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setTermForm({ name: '', startDate: '', endDate: '', academicYearId: '' });
      setTermMessage({ type: 'success', text: 'Term created successfully!' });
      setTimeout(() => setTermMessage(null), 3000);
    },
    onError: () => {
      setTermMessage({ type: 'error', text: 'Failed to create term' });
      setTimeout(() => setTermMessage(null), 3000);
    },
  });

  const createAcademicYearMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) => academicYearApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setAcademicYearForm({ name: '', startDate: '', endDate: '' });
      setAcademicYearMessage({ type: 'success', text: 'Academic year created successfully!' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
    onError: () => {
      setAcademicYearMessage({ type: 'error', text: 'Failed to create academic year' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
  });

  const setCurrentAcademicYearMutation = useMutation({
    mutationFn: (id: string) => academicYearApi.setCurrent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setAcademicYearMessage({ type: 'success', text: 'Current academic year updated!' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
    onError: () => {
      setAcademicYearMessage({ type: 'error', text: 'Failed to update current academic year' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
  });

  const setCurrentTermMutation = useMutation({
    mutationFn: (id: string) => termApi.setCurrent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setTermMessage({ type: 'success', text: 'Current term updated successfully!' });
      setTimeout(() => setTermMessage(null), 3000);
    },
    onError: () => {
      setTermMessage({ type: 'error', text: 'Failed to update current term' });
      setTimeout(() => setTermMessage(null), 3000);
    },
  });

  const updateAppearanceMutation = useMutation({
    mutationFn: (data: any) => schoolApi.updateBranding(data),
    onSuccess: () => {
      setAppearanceMessage({ type: 'success', text: 'Appearance settings saved successfully!' });
      setTimeout(() => setAppearanceMessage(null), 3000);
    },
    onError: () => {
      setAppearanceMessage({ type: 'error', text: 'Failed to save appearance settings' });
      setTimeout(() => setAppearanceMessage(null), 3000);
    },
  });

  const [appearanceMessage, setAppearanceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnrollments: true,
    smsFeeAlerts: true,
    pushResults: false,
    dailyAttendance: true,
    weeklyReports: false,
  });

  const [notificationMessage, setNotificationMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [gradingMessage, setGradingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const saveGradingMutation = useMutation({
    mutationFn: async () => {
      await schoolApi.updateGradingSystem(gradingSystemCode);
      if (selectedGradingSystem?.id) {
        await gradingSystemApi.update(selectedGradingSystem.id, {
          gradeScales: editableScales.map((s: any) => ({
            grade: s.grade,
            points: s.points,
            minScore: s.minScore,
            maxScore: s.maxScore,
            remark: s.description,
          })),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grading-systems'] });
      setGradingMessage({ type: 'success', text: 'Grading system saved successfully!' });
      setTimeout(() => setGradingMessage(null), 3000);
    },
    onError: () => {
      setGradingMessage({ type: 'error', text: 'Failed to save grading system' });
      setTimeout(() => setGradingMessage(null), 3000);
    },
  });

  const tabs = [
    { key: 'school' as SettingsTab, label: 'School Info', icon: '🏫' },
    { key: 'academic' as SettingsTab, label: 'Academic Year', icon: '📅' },
    { key: 'terms' as SettingsTab, label: 'Terms', icon: '📚' },
    { key: 'grading' as SettingsTab, label: 'Grading System', icon: '📊' },
    { key: 'appearance' as SettingsTab, label: 'Appearance', icon: '🎨' },
    { key: 'notifications' as SettingsTab, label: 'Notifications', icon: '🔔' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your school settings and configurations</p>
        </div>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'school' && (
        <div className="bg-white rounded-lg shadow p-6">
          {saveMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg ${
              saveMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {saveMessage.text}
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">School Information</h2>
            {!isEditing ? (
              <button
                onClick={() => {
                  if (schoolData) {
                    setSchoolForm({
                      name: schoolData.name || '',
                      registrationNumber: schoolData.registrationNumber || '',
                      phone: schoolData.phone || '',
                      email: schoolData.email || '',
                      address: schoolData.address || '',
                      motto: schoolData.motto || '',
                      website: schoolData.website || '',
                    });
                  }
                  setIsEditing(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit School Info
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateSchoolMutation.mutate(schoolForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>

          {schoolLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{schoolData?.name || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Registration Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={schoolForm.registrationNumber}
                    onChange={(e) => setSchoolForm({ ...schoolForm, registrationNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{schoolData?.registrationNumber || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{schoolData?.phone || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{schoolData?.email || '-'}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                {isEditing ? (
                  <textarea
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{schoolData?.address || '-'}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">School Motto</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={schoolForm.motto}
                    onChange={(e) => setSchoolForm({ ...schoolForm, motto: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Enter school motto..."
                  />
                ) : (
                  <p className="text-gray-900 italic">{schoolData?.motto || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                {isEditing ? (
                  <input
                    type="url"
                    value={schoolForm.website}
                    onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{schoolData?.website || '-'}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'terms' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            {termMessage && (
              <div className={`mb-4 px-4 py-3 rounded-lg ${
                termMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {termMessage.text}
              </div>
            )}
            <h2 className="text-xl font-semibold mb-6">Create New Term</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term Name</label>
                <input
                  type="text"
                  value={termForm.name}
                  onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                  placeholder="e.g., Term 1"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                <select
                  value={termForm.academicYearId}
                  onChange={(e) => setTermForm({ ...termForm, academicYearId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select Academic Year</option>
                  {academicYearsData?.map((year: any) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={termForm.startDate}
                  onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={termForm.endDate}
                  onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  onClick={() => createTermMutation.mutate(termForm)}
                  disabled={!termForm.name || !termForm.startDate || !termForm.endDate}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Create Term
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">All Terms</h2>
            {termsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : termsData && termsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Term Name</th>
                      <th className="text-left py-3 px-4">Academic Year</th>
                      <th className="text-left py-3 px-4">Start Date</th>
                      <th className="text-left py-3 px-4">End Date</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {termsData.map((term: any) => (
                      <tr key={term.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{term.name}</td>
                        <td className="py-3 px-4">{term.academicYear?.name || '-'}</td>
                        <td className="py-3 px-4">{term.startDate ? new Date(term.startDate).toLocaleDateString() : '-'}</td>
                        <td className="py-3 px-4">{term.endDate ? new Date(term.endDate).toLocaleDateString() : '-'}</td>
                        <td className="py-3 px-4">
                          {term.isCurrent ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Current</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">Inactive</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {!term.isCurrent && (
                            <button
                              onClick={() => setCurrentTermMutation.mutate(term.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Set as Current
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No terms created yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            {gradingMessage && (
              <div className={`mb-4 px-4 py-3 rounded-lg ${
                gradingMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {gradingMessage.text}
              </div>
            )}
            <h2 className="text-xl font-semibold mb-6">Grading System Configuration</h2>
            
            <div className="flex gap-4 mb-6">
              {Object.entries(gradingSystemCodeToLabel).map(([code, label]) => (
                <button
                  key={code}
                  onClick={() => setGradingSystemCode(code)}
                  className={`px-6 py-3 rounded-lg font-medium ${
                    gradingSystemCode === code
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4">Grade</th>
                    <th className="text-left py-3 px-4">Points</th>
                    <th className="text-left py-3 px-4">Min Score</th>
                    <th className="text-left py-3 px-4">Max Score</th>
                    <th className="text-left py-3 px-4">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {editableScales.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500">Loading grading scales...</td></tr>
                  ) : editableScales.map((grade, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4 font-bold text-lg">{grade.grade}</td>
                      <td className="py-3 px-4">
                        <input type="number" step="0.1" value={grade.points}
                          onChange={(e) => { const next = [...editableScales]; next[index] = { ...next[index], points: parseFloat(e.target.value) }; setEditableScales(next); }}
                          className="w-20 px-2 py-1 border rounded" />
                      </td>
                      <td className="py-3 px-4">
                        <input type="number" value={grade.minScore}
                          onChange={(e) => { const next = [...editableScales]; next[index] = { ...next[index], minScore: parseInt(e.target.value) }; setEditableScales(next); }}
                          className="w-20 px-2 py-1 border rounded" />
                      </td>
                      <td className="py-3 px-4">
                        <input type="number" value={grade.maxScore}
                          onChange={(e) => { const next = [...editableScales]; next[index] = { ...next[index], maxScore: parseInt(e.target.value) }; setEditableScales(next); }}
                          className="w-20 px-2 py-1 border rounded" />
                      </td>
                      <td className="py-3 px-4">
                        <input type="text" value={grade.description}
                          onChange={(e) => { const next = [...editableScales]; next[index] = { ...next[index], description: e.target.value }; setEditableScales(next); }}
                          className="w-full px-2 py-1 border rounded" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setGradingSystemCode(timeSettings?.gradingSystem || 'SECONDARY_ECZ')}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Reset
              </button>
              <button
                onClick={() => saveGradingMutation.mutate()}
                disabled={saveGradingMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saveGradingMutation.isPending ? 'Saving...' : 'Save Grading System'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'academic' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            {academicYearMessage && (
              <div className={`mb-4 px-4 py-3 rounded-lg ${
                academicYearMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {academicYearMessage.text}
              </div>
            )}
            <h2 className="text-xl font-semibold mb-6">Create Academic Year</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year Name</label>
                <input
                  type="text"
                  value={academicYearForm.name}
                  onChange={(e) => setAcademicYearForm({ ...academicYearForm, name: e.target.value })}
                  placeholder="e.g., 2024"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={academicYearForm.startDate}
                  onChange={(e) => setAcademicYearForm({ ...academicYearForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={academicYearForm.endDate}
                  onChange={(e) => setAcademicYearForm({ ...academicYearForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => createAcademicYearMutation.mutate(academicYearForm)}
                disabled={!academicYearForm.name || !academicYearForm.startDate || !academicYearForm.endDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Create Academic Year
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">All Academic Years</h2>
            {academicYearsLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : academicYearsData && academicYearsData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Year Name</th>
                      <th className="text-left py-3 px-4">Start Date</th>
                      <th className="text-left py-3 px-4">End Date</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicYearsData.map((year: any) => (
                      <tr key={year.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{year.name}</td>
                        <td className="py-3 px-4">{year.startDate ? new Date(year.startDate).toLocaleDateString() : '-'}</td>
                        <td className="py-3 px-4">{year.endDate ? new Date(year.endDate).toLocaleDateString() : '-'}</td>
                        <td className="py-3 px-4">
                          {year.isCurrent ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Current</span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">Inactive</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {!year.isCurrent && (
                            <button
                              onClick={() => setCurrentAcademicYearMutation.mutate(year.id)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Set as Current
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No academic years created yet</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="bg-white rounded-lg shadow p-6">
          {appearanceMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg ${
              appearanceMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {appearanceMessage.text}
            </div>
          )}
          <h2 className="text-xl font-semibold mb-6">Appearance Settings</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
              <div className="flex gap-2">
                {['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-12 h-12 rounded-lg border-2 ${
                      selectedColor === color ? 'border-blue-600 ring-2 ring-blue-300' : 'border-gray-300 hover:border-blue-400'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Logo Upload</label>
              <input type="file" accept="image/*" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <button
              onClick={() => updateAppearanceMutation.mutate({ primaryColor: selectedColor })}
              disabled={updateAppearanceMutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {updateAppearanceMutation.isPending ? 'Saving...' : 'Save Appearance Settings'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-lg shadow p-6">
          {notificationMessage && (
            <div className={`mb-4 px-4 py-3 rounded-lg ${
              notificationMessage.type === 'success' 
                ? 'bg-green-50 text-green-700 border border-green-200' 
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {notificationMessage.text}
            </div>
          )}
          <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={notificationSettings.emailEnrollments}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailEnrollments: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" 
              />
              <span>Email notifications for new enrollments</span>
            </label>
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={notificationSettings.smsFeeAlerts}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, smsFeeAlerts: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" 
              />
              <span>SMS alerts for fee payments</span>
            </label>
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={notificationSettings.pushResults}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, pushResults: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" 
              />
              <span>Push notifications for results</span>
            </label>
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={notificationSettings.dailyAttendance}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, dailyAttendance: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" 
              />
              <span>Daily attendance summaries</span>
            </label>
            <label className="flex items-center gap-3">
              <input 
                type="checkbox" 
                checked={notificationSettings.weeklyReports}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, weeklyReports: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded" 
              />
              <span>Weekly performance reports</span>
            </label>
          </div>
          <button 
            onClick={() => {
              setNotificationMessage({ type: 'success', text: 'Notification settings saved successfully!' });
              setTimeout(() => setNotificationMessage(null), 3000);
            }}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Notification Settings
          </button>
        </div>
      )}
    </div>
  );
}
