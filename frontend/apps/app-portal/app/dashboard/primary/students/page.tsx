'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi, classApi, enrollmentApi, academicYearApi, termApi } from '@/lib/api';
import { Student } from '@/types/student';

const INTAKE_TYPES = [
  { value: 'admission', label: 'New Admission', desc: 'Direct entry new student (any grade)' },
  { value: 'pre-school', label: 'Pre-School Intake', desc: 'ECE / Nursery / Reception' },
  { value: 'grade1', label: 'Grade 1 Intake', desc: 'New entrants (age 6–7)' },
  { value: 'transfer', label: 'Transfer Pupil', desc: 'From another school' },
  { value: 're-admission', label: 'Re-Admission', desc: 'Returning after break' },
];

const GRADE_OPTIONS = ['Pre', '1', '2', '3', '4', '5', '6', '7'];

export default function PrimaryStudentsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'admission' | 'pre-school' | 'grade1' | 'transfer'>('all');
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    admissionNumber: '',
    dateOfBirth: '',
    gender: '',
    intakeType: 'grade1',
    grade: '1',
    classId: '',
    academicYearId: '',
    termId: '',
    previousSchool: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
  });

  const { data: students, isLoading } = useQuery({
    queryKey: ['primary-students'],
    queryFn: () => studentApi.getAll({}).then(r => r.data?.data || r.data || []),
  });

  const { data: classes } = useQuery({
    queryKey: ['primary-classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const { data: academicYears } = useQuery({
    queryKey: ['primary-academic-years'],
    queryFn: () => academicYearApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const { data: terms } = useQuery({
    queryKey: ['primary-terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data || []),
  });

  const classList = Array.isArray(classes) ? classes : [];
  const academicYearList = Array.isArray(academicYears) ? academicYears : [];
  const termList = Array.isArray(terms) ? terms : [];
  const currentAcademicYear = academicYearList.find((y: any) => y.isCurrent);

  const toCreateStudentDto = (form: any) => ({
    firstName: form.firstName,
    lastName: form.lastName,
    admissionNumber: form.admissionNumber,
    dateOfBirth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    parentName: form.guardianName || undefined,
    parentPhone: form.guardianPhone || undefined,
    parentEmail: form.guardianEmail || undefined,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      let studentId: string | undefined;
      let studentRes: any;

      try {
        studentRes = await studentApi.create(toCreateStudentDto(data));
        studentId = studentRes.data?.data?.id || studentRes.data?.id || studentRes?.id;
      } catch (err: any) {
        // Student may have been created on the backend even if parent/credential delivery failed
        studentId = err?.response?.data?.data?.id || err?.response?.data?.id;
        if (!studentId) throw err;
      }

      if (data.classId && data.academicYearId && studentId) {
        await enrollmentApi.create({
          studentId,
          classId: data.classId,
          academicYearId: data.academicYearId,
          termId: data.termId || undefined,
        }).catch((enrollErr: any) => {
          console.warn('Auto-enrollment failed, student can be enrolled manually:', enrollErr?.response?.data);
        });
      }

      return studentRes;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['primary-students'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setShowRegisterForm(false);
      setFormData({
        firstName: '', lastName: '', admissionNumber: '', dateOfBirth: '', gender: '',
        intakeType: 'grade1', grade: '1', classId: '', academicYearId: '', termId: '', previousSchool: '',
        guardianName: '', guardianPhone: '', guardianEmail: '',
      });
      setRegisterError('');
    },
    onError: (err: any) => {
      setRegisterError(err?.response?.data?.message || err?.response?.data?.error || 'Registration failed. Check required fields and try again.');
    },
  });

  const filteredStudents = (students || []).filter((s: Student) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pre-school') return (s.grade || '').toLowerCase().includes('pre') || (s.className || '').toLowerCase().includes('pre');
    if (activeTab === 'grade1') return (s.grade || '').includes('1') && !(s.className || '').toLowerCase().includes('pre');
    if (activeTab === 'transfer') return s.transferIn || s.previousSchool;
    if (activeTab === 'admission') return !s.transferIn && !s.previousSchool && !(s.grade || '').toLowerCase().includes('pre') && !(s.grade || '').includes('1');
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pupil Management</h1>
          <p className="text-gray-500 text-sm mt-1">Pre-school intake, Grade 1 registration, and transfer pupils</p>
        </div>
        <button
          onClick={() => setShowRegisterForm(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 cursor-pointer"
        >
          <i className="fas fa-user-plus" />
          Register New Pupil
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="border-b border-gray-100">
          <div className="flex gap-1 p-1">
            {[
              { key: 'all' as const, label: 'All Pupils', icon: 'fa-users' },
              { key: 'admission' as const, label: 'New Admission', icon: 'fa-user-plus' },
              { key: 'pre-school' as const, label: 'Pre-School', icon: 'fa-baby' },
              { key: 'grade1' as const, label: 'Grade 1 Intake', icon: 'fa-child' },
              { key: 'transfer' as const, label: 'Transfers', icon: 'fa-exchange-alt' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.key
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <i className={`fas ${tab.icon}`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading pupils...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 text-gray-300"><i className="fas fa-user-graduate" /></div>
              <p className="text-gray-500">No pupils found in this category.</p>
              <button
                onClick={() => setShowRegisterForm(true)}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 cursor-pointer"
            >
              Register First Pupil
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Gender</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">DOB</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Guardian</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStudents.map((student: Student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs font-bold">
                          {student.firstName?.[0]}{student.lastName?.[0]}
                        </div>
                        <span className="font-medium text-gray-900">{student.firstName} {student.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                        {student.className || student.grade || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{student.gender || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{student.guardianName || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTAKE_TYPES.map(intake => (
          <div key={intake.value} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                <i className={`fas ${intake.value === 'admission' ? 'fa-user-plus' : intake.value === 'pre-school' ? 'fa-baby' : intake.value === 'grade1' ? 'fa-child' : intake.value === 'transfer' ? 'fa-exchange-alt' : intake.value === 're-admission' ? 'fa-undo' : 'fa-history'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{intake.label}</h3>
                <p className="text-xs text-gray-500">{intake.desc}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setFormData(prev => ({ ...prev, intakeType: intake.value }));
                setShowRegisterForm(true);
              }}
              className="text-sm text-emerald-600 font-medium hover:text-emerald-700 cursor-pointer"
            >
              Register Now →
            </button>
          </div>
        ))}
      </div>

      {showRegisterForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRegisterForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Register New Pupil</h2>
              <button onClick={() => setShowRegisterForm(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {registerError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                  <i className="fas fa-exclamation-circle mt-0.5" />
                  <span>{registerError}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text" value={formData.firstName}
                    onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text" value={formData.lastName}
                    onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission # *</label>
                  <input
                    type="text" value={formData.admissionNumber}
                    onChange={e => setFormData(p => ({ ...p, admissionNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="e.g. ST-2024-001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date" value={formData.dateOfBirth}
                    onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intake Type</label>
                  <select
                    value={formData.intakeType}
                    onChange={e => setFormData(p => ({ ...p, intakeType: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {INTAKE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <select
                    value={formData.grade}
                    onChange={e => setFormData(p => ({ ...p, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    {GRADE_OPTIONS.map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={formData.classId}
                  onChange={e => setFormData(p => ({ ...p, classId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select class (optional)</option>
                  {classList.map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year *</label>
                  <select
                    value={formData.academicYearId}
                    onChange={e => setFormData(p => ({ ...p, academicYearId: e.target.value, termId: '' }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select academic year</option>
                    {academicYearList.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.name} {y.isCurrent ? '(Current)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                  <select
                    value={formData.termId}
                    onChange={e => setFormData(p => ({ ...p, termId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="">Select term (optional)</option>
                    {termList
                      .filter((t: any) => t.academicYearId === formData.academicYearId)
                      .map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    }
                  </select>
                </div>
              </div>
              {formData.intakeType === 'transfer' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Previous School</label>
                  <input
                    type="text" value={formData.previousSchool}
                    onChange={e => setFormData(p => ({ ...p, previousSchool: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Previous school name"
                  />
                </div>
              )}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Guardian Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guardian Name</label>
                    <input
                      type="text" value={formData.guardianName}
                      onChange={e => setFormData(p => ({ ...p, guardianName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="text" value={formData.guardianPhone}
                      onChange={e => setFormData(p => ({ ...p, guardianPhone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                  <input
                    type="email" value={formData.guardianEmail}
                    onChange={e => setFormData(p => ({ ...p, guardianEmail: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="Email address"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowRegisterForm(false)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!formData.firstName || !formData.lastName || !formData.admissionNumber) return;
                  setRegisterError('');
                  registerMutation.mutate(formData);
                }}
                disabled={registerMutation.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  registerMutation.isPending
                    ? 'bg-emerald-400 text-white cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {registerMutation.isPending ? 'Registering...' : 'Register Pupil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
