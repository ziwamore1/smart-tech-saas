'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schoolApi, termApi, academicYearApi, gradingSystemApi, holidayApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ReadOnlyBanner } from '@/components/permissions/ReadOnlyBanner';

type SettingsTab = 'school' | 'academic' | 'terms' | 'grading' | 'holidays' | 'appearance' | 'notifications';

type GradeEntry = {
  grade: string;
  points: number;
  minScore: number;
  maxScore: number;
  description: string;
};

const HOLIDAY_TYPES = [
  { value: 'PUBLIC', label: 'Public Holiday', color: '#dc2626', bg: '#fee2e2' },
  { value: 'SCHOOL', label: 'School Holiday', color: '#2563eb', bg: '#dbeafe' },
  { value: 'RELIGIOUS', label: 'Religious Holiday', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'CUSTOM', label: 'Custom Holiday', color: '#059669', bg: '#d1faee' },
];

function HolidaySettingsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '', type: 'PUBLIC', isRecurring: false });
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const userRoles = user?.allRoles || user?.roles || user?.schoolRoles || [];
  const isDirector = userRoles.some((r: string) => ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head'].includes(r));

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ['holidays'],
    queryFn: async () => {
      const res = await holidayApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return holidayApi.update(editingId, form);
      }
      return holidayApi.create(form);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setMsg({ type: 'success', text: editingId ? 'Holiday updated!' : 'Holiday created!' });
      resetForm();
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: any) => {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to save holiday' });
      setTimeout(() => setMsg(null), 4000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => holidayApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setMsg({ type: 'success', text: 'Holiday deleted!' });
      setTimeout(() => setMsg(null), 3000);
    },
  });

  const seedMutation = useMutation({
    mutationFn: (year: number) => holidayApi.seedNationalHolidays(year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setMsg({ type: 'success', text: 'Zambian national holidays seeded!' });
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e: any) => {
      setMsg({ type: 'error', text: e?.response?.data?.message || 'Failed to seed holidays' });
      setTimeout(() => setMsg(null), 4000);
    },
  });

  const resetForm = () => {
    setForm({ name: '', description: '', startDate: '', endDate: '', type: 'PUBLIC', isRecurring: false });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (h: any) => {
    setForm({
      name: h.name,
      description: h.description || '',
      startDate: h.startDate?.split('T')[0] || '',
      endDate: h.endDate?.split('T')[0] || '',
      type: h.type || 'PUBLIC',
      isRecurring: h.isRecurring || false,
    });
    setEditingId(h.id);
    setShowForm(true);
  };

  const getTypeConfig = (type: string) => HOLIDAY_TYPES.find(t => t.value === type) || HOLIDAY_TYPES[0];

  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Holidays</h2>
          <p className="text-sm text-gray-500 mt-1">Manage school holidays. Dates marked as holidays block attendance marking.</p>
        </div>
        <div className="flex gap-2">
          {isDirector && (
            <>
              <button
                onClick={() => seedMutation.mutate(currentYear)}
                disabled={seedMutation.isPending}
                className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 text-sm font-medium disabled:opacity-50"
              >
                {seedMutation.isPending ? 'Seeding...' : `Seed ${currentYear} Zambian Holidays`}
              </button>
              <button
                onClick={() => { resetForm(); setShowForm(!showForm); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                {showForm ? 'Cancel' : '+ Add Holiday'}
              </button>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border-2 border-indigo-200 rounded-xl bg-indigo-50/30">
          <h3 className="font-semibold text-gray-800 mb-3">{editingId ? 'Edit Holiday' : 'New Holiday'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                placeholder="e.g. Independence Day" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none">
                {HOLIDAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Date *</label>
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                placeholder="Optional description" />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded" />
                <span className="text-sm text-gray-700">Repeats every year</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.startDate || !form.endDate || saveMutation.isPending}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading holidays...</div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">🎉</p>
          <p className="font-medium">No holidays configured yet</p>
          <p className="text-sm mt-1">Click "Seed {currentYear} Zambian Holidays" or add custom holidays</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dates</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recurring</th>
                <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                {isDirector && (
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {holidays.map((h: any) => {
                const tc = getTypeConfig(h.type);
                const start = h.startDate?.split('T')[0] || '';
                const end = h.endDate?.split('T')[0] || '';
                const isPast = end && end < today;
                const isActive = start <= today && end >= today;
                return (
                  <tr key={h.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 14px' }}>
                      <div className="font-medium text-gray-900 text-sm">{h.name}</div>
                      {h.description && <div className="text-xs text-gray-500 mt-0.5">{h.description}</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: tc.color, background: tc.bg }}>
                        {tc.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#475569' }}>
                      {start === end ? start : `${start} → ${end}`}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {h.isRecurring ? <span style={{ color: '#059669', fontWeight: 600, fontSize: 12 }}>✓ Yes</span> : <span style={{ color: '#94a3b8', fontSize: 12 }}>No</span>}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {isActive ? (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: '#059669', background: '#d1fae5' }}>Active</span>
                      ) : isPast ? (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: '#94a3b8', background: '#f1f5f9' }}>Past</span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: '#2563eb', background: '#dbeafe' }}>Upcoming</span>
                      )}
                    </td>
                    {isDirector && (
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button onClick={() => startEdit(h)}
                            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => { if (confirm(`Delete "${h.name}"?`)) deleteMutation.mutate(h.id); }}
                            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

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
  const currentAcademicYear = academicYearsData?.find((y: any) => y.isCurrent);

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

  useEffect(() => {
    if (currentAcademicYear?.id) {
      setTermForm(prev => ({ ...prev, academicYearId: prev.academicYearId || currentAcademicYear.id }));
    }
  }, [currentAcademicYear?.id]);

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

  const { data: gradingSystemsList, isLoading: gsLoading, error: gsError } = useQuery({
    queryKey: ['grading-systems'],
    queryFn: () => gradingSystemApi.getAll().then((res: any) => {
      const data = res.data?.data || res.data;
      console.log('[Settings] grading systems response:', data);
      return Array.isArray(data) ? data : [];
    }),
  });

  const codeToName: Record<string, string> = {
    PRIMARY_ECZ: 'Primary Grading System',
    GRADE7_ECZ: 'ECZ Grade 7 Grading System',
    SECONDARY_ECZ: 'ECZ Secondary Grading System',
    FORMS_ECZ: 'ECZ Forms Grading System',
    COLLEGE_GPA: 'College GPA Grading System',
    UNIVERSITY_CGPA: 'University CGPA Grading System',
  };

  const gradingSystemCodeToLabel: Record<string, string> = {
    PRIMARY_ECZ: 'Primary (Grades 1-4)',
    GRADE7_ECZ: 'ECZ Grade 7 (Grades 5-7)',
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
      setTermForm({ name: '', startDate: '', endDate: '', academicYearId: currentAcademicYear?.id || '' });
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

  const [editingYear, setEditingYear] = useState<{ id: string; name: string; startDate: string; endDate: string } | null>(null);
  const [deleteYearId, setDeleteYearId] = useState<string | null>(null);
  const [editingTerm, setEditingTerm] = useState<{ id: string; name: string; startDate: string; endDate: string; academicYearId: string } | null>(null);
  const [deleteTermId, setDeleteTermId] = useState<string | null>(null);

  const updateAcademicYearMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; startDate?: string; endDate?: string } }) =>
      academicYearApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setEditingYear(null);
      setAcademicYearMessage({ type: 'success', text: 'Academic year updated successfully!' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
    onError: () => {
      setAcademicYearMessage({ type: 'error', text: 'Failed to update academic year' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
  });

  const deleteAcademicYearMutation = useMutation({
    mutationFn: (id: string) => academicYearApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['academic-years'] });
      setDeleteYearId(null);
      setAcademicYearMessage({ type: 'success', text: 'Academic year deleted!' });
      setTimeout(() => setAcademicYearMessage(null), 3000);
    },
    onError: (err: any) => {
      setAcademicYearMessage({ type: 'error', text: err?.response?.data?.message || 'Failed to delete academic year' });
      setTimeout(() => setAcademicYearMessage(null), 5000);
    },
  });

  const updateTermMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; startDate?: string; endDate?: string } }) =>
      termApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setEditingTerm(null);
      setTermMessage({ type: 'success', text: 'Term updated successfully!' });
      setTimeout(() => setTermMessage(null), 3000);
    },
    onError: () => {
      setTermMessage({ type: 'error', text: 'Failed to update term' });
      setTimeout(() => setTermMessage(null), 3000);
    },
  });

  const deleteTermMutation = useMutation({
    mutationFn: (id: string) => termApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terms'] });
      setDeleteTermId(null);
      setTermMessage({ type: 'success', text: 'Term deleted!' });
      setTimeout(() => setTermMessage(null), 3000);
    },
    onError: () => {
      setTermMessage({ type: 'error', text: 'Failed to delete term' });
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
    { key: 'holidays' as SettingsTab, label: 'Holidays', icon: '🎉' },
    { key: 'appearance' as SettingsTab, label: 'Appearance', icon: '🎨' },
    { key: 'notifications' as SettingsTab, label: 'Notifications', icon: '🔔' },
  ];

  return (
    <div className="space-y-6">
      <ReadOnlyBanner managePermission="settings.edit" />
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
                  disabled={updateSchoolMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updateSchoolMutation.isPending ? (
                    <><svg className="animate-spin h-4 w-4 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Saving...</>
                  ) : 'Save Changes'}
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
                  disabled={createTermMutation.isPending || !termForm.name || !termForm.startDate || !termForm.endDate}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md disabled:bg-gray-400 disabled:hover:shadow-none transition-all duration-200"
                >
                  {createTermMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating...
                    </span>
                  ) : 'Create Term'}
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingTerm({
                                id: term.id,
                                name: term.name,
                                startDate: term.startDate?.split('T')[0] || '',
                                endDate: term.endDate?.split('T')[0] || '',
                                academicYearId: term.academicYearId || '',
                              })}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            {!term.isCurrent && (
                              <button
                                onClick={() => setCurrentTermMutation.mutate(term.id)}
                                disabled={setCurrentTermMutation.isPending}
                                className="text-blue-600 hover:text-blue-800 text-sm disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-150"
                              >
                                {setCurrentTermMutation.isPending ? 'Setting...' : 'Set Current'}
                              </button>
                            )}
                            {!term.isCurrent && (
                              <button
                                onClick={() => setDeleteTermId(term.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
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

          {/* Edit Term Modal */}
          {editingTerm && (
            <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
                <h3 className="text-lg font-semibold mb-4">Edit Term</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Term Name</label>
                    <input
                      type="text"
                      value={editingTerm.name}
                      onChange={(e) => setEditingTerm({ ...editingTerm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Academic Year</label>
                    <select
                      value={editingTerm.academicYearId}
                      onChange={(e) => setEditingTerm({ ...editingTerm, academicYearId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">Select Academic Year</option>
                      {academicYearsData?.map((year: any) => (
                        <option key={year.id} value={year.id}>{year.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={editingTerm.startDate}
                      onChange={(e) => setEditingTerm({ ...editingTerm, startDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={editingTerm.endDate}
                      onChange={(e) => setEditingTerm({ ...editingTerm, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingTerm(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateTermMutation.mutate({
                      id: editingTerm.id,
                      data: {
                        name: editingTerm.name,
                        startDate: editingTerm.startDate,
                        endDate: editingTerm.endDate,
                        academicYearId: editingTerm.academicYearId,
                      },
                    })}
                    disabled={updateTermMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none transition-all duration-200"
                  >
                    {updateTermMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </span>
                    ) : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Term Confirmation */}
          {deleteTermId && (
            <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-lg font-semibold mb-2">Delete Term?</h3>
                <p className="text-gray-600 mb-4">This action cannot be undone.</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteTermId(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteTermMutation.mutate(deleteTermId)}
                    disabled={deleteTermMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none transition-all duration-200"
                  >
                    {deleteTermMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Deleting...
                      </span>
                    ) : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  {gsLoading ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500">Loading grading systems...</td></tr>
                  ) : gsError ? (
                    <tr><td colSpan={5} className="py-4 text-center text-red-500">Error loading grading systems</td></tr>
                  ) : editableScales.length === 0 ? (
                    <tr><td colSpan={5} className="py-4 text-center text-gray-500">No grading scales found for the selected system</td></tr>
                  ) : editableScales.map((grade, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3 px-4 font-bold text-lg">{grade.grade}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step="0.1"
                          value={grade.points}
                          onChange={(e) => {
                            const next = [...editableScales];
                            next[index] = { ...next[index], points: parseFloat(e.target.value) };
                            setEditableScales(next);
                          }}
                          className="w-20 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={grade.minScore}
                          onChange={(e) => {
                            const next = [...editableScales];
                            next[index] = { ...next[index], minScore: parseInt(e.target.value) };
                            setEditableScales(next);
                          }}
                          className="w-20 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={grade.maxScore}
                          onChange={(e) => {
                            const next = [...editableScales];
                            next[index] = { ...next[index], maxScore: parseInt(e.target.value) };
                            setEditableScales(next);
                          }}
                          className="w-20 px-2 py-1 border rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={grade.description}
                          onChange={(e) => {
                            const next = [...editableScales];
                            next[index] = { ...next[index], description: e.target.value };
                            setEditableScales(next);
                          }}
                          className="w-full px-2 py-1 border rounded"
                        />
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
                disabled={createAcademicYearMutation.isPending || !academicYearForm.name || !academicYearForm.startDate || !academicYearForm.endDate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md disabled:bg-gray-400 disabled:hover:shadow-none transition-all duration-200"
              >
                {createAcademicYearMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating...
                  </span>
                ) : 'Create Academic Year'}
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setEditingYear({
                                id: year.id,
                                name: year.name,
                                startDate: year.startDate?.split('T')[0] || '',
                                endDate: year.endDate?.split('T')[0] || '',
                              })}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                            {!year.isCurrent && (
                              <button
                                onClick={() => setCurrentAcademicYearMutation.mutate(year.id)}
                                disabled={setCurrentAcademicYearMutation.isPending}
                                className="text-blue-600 hover:text-blue-800 text-sm disabled:text-gray-400 disabled:cursor-not-allowed transition-colors duration-150"
                              >
                                {setCurrentAcademicYearMutation.isPending ? 'Setting...' : 'Set Current'}
                              </button>
                            )}
                            {!year.isCurrent && (
                              <button
                                onClick={() => setDeleteYearId(year.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            )}
                          </div>
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

          {/* Edit Academic Year Modal */}
          {editingYear && (
            <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
                <h3 className="text-lg font-semibold mb-4">Edit Academic Year</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year Name</label>
                    <input
                      type="text"
                      value={editingYear.name}
                      onChange={(e) => setEditingYear({ ...editingYear, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={editingYear.startDate}
                      onChange={(e) => setEditingYear({ ...editingYear, startDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={editingYear.endDate}
                      onChange={(e) => setEditingYear({ ...editingYear, endDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setEditingYear(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateAcademicYearMutation.mutate({
                      id: editingYear.id,
                      data: { name: editingYear.name, startDate: editingYear.startDate, endDate: editingYear.endDate },
                    })}
                    disabled={updateAcademicYearMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none transition-all duration-200"
                  >
                    {updateAcademicYearMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </span>
                    ) : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Academic Year Confirmation */}
          {deleteYearId && (
            <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-lg font-semibold mb-2">Delete Academic Year?</h3>
                <p className="text-gray-600 mb-4">This action cannot be undone. Terms within this year must be deleted first.</p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteYearId(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteAcademicYearMutation.mutate(deleteYearId)}
                    disabled={deleteAcademicYearMutation.isPending}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 hover:shadow-md disabled:opacity-50 disabled:hover:shadow-none transition-all duration-200"
                  >
                    {deleteAcademicYearMutation.isPending ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Deleting...
                      </span>
                    ) : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
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

      {activeTab === 'holidays' && (
        <HolidaySettingsTab />
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
