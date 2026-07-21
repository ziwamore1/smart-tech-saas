'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, classApi, studentApi, api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSchoolSocket } from '@/lib/use-school-socket';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'sick' | 'suspended' | 'activity' | 'partial_attendance';

interface StatusStyle { label: string; color: string; bg: string; hoverBg: string; activeBg: string; border: string; icon: string; dot: string }
const STATUS_CONFIG: Record<AttendanceStatus, StatusStyle> = {
  present: { label: 'Present', color: '#065f46', bg: '#d1fae5', hoverBg: '#a7f3d0', activeBg: '#059669', border: '#34d399', icon: '✓', dot: '#059669' },
  absent: { label: 'Absent', color: '#991b1b', bg: '#fee2e2', hoverBg: '#fecaca', activeBg: '#dc2626', border: '#f87171', icon: '✗', dot: '#dc2626' },
  late: { label: 'Late', color: '#9a3412', bg: '#ffedd5', hoverBg: '#fed7aa', activeBg: '#ea580c', border: '#fb923c', icon: '◐', dot: '#ea580c' },
  excused: { label: 'Excused', color: '#1e40af', bg: '#dbeafe', hoverBg: '#bfdbfe', activeBg: '#2563eb', border: '#60a5fa', icon: '○', dot: '#2563eb' },
  sick: { label: 'Sick', color: '#854d0e', bg: '#fef9c3', hoverBg: '#fef08a', activeBg: '#ca8a04', border: '#facc15', icon: '⚕', dot: '#ca8a04' },
  suspended: { label: 'Suspended', color: '#374151', bg: '#e8ddd0', hoverBg: '#d1d5db', activeBg: '#6b7280', border: '#9ca3af', icon: '⊘', dot: '#6b7280' },
  activity: { label: 'Activity', color: '#5b21b6', bg: '#ede9fe', hoverBg: '#ddd6fe', activeBg: '#7c3aed', border: '#a78bfa', icon: '⚡', dot: '#7c3aed' },
  partial_attendance: { label: 'Partial', color: '#115e59', bg: '#ccfbf1', hoverBg: '#a7f3d0', activeBg: '#0d9488', border: '#5eead4', icon: '◷', dot: '#0d9488' },
};

const BULK_ACTIONS: Array<{ status: AttendanceStatus | 'none'; label: string; bg: string }> = [
  { status: 'present', label: 'All Present', bg: '#059669' },
  { status: 'absent', label: 'All Absent', bg: '#dc2626' },
  { status: 'late', label: 'All Late', bg: '#ea580c' },
  { status: 'excused', label: 'All Excused', bg: '#2563eb' },
  { status: 'sick', label: 'All Sick', bg: '#ca8a04' },
  { status: 'suspended', label: 'All Suspended', bg: '#6b7280' },
  { status: 'activity', label: 'All Activity', bg: '#7c3aed' },
  { status: 'partial_attendance', label: 'All Partial', bg: '#0d9488' },
  { status: 'none', label: 'Clear All', bg: '#ffffff' },
];

const KEYBOARD_SHORTCUTS: Record<string, AttendanceStatus> = {
  p: 'present', P: 'present',
  a: 'absent', A: 'absent',
  l: 'late', L: 'late',
  x: 'excused', X: 'excused',
  s: 'sick', S: 'sick',
  u: 'suspended', U: 'suspended',
  t: 'activity', T: 'activity',
  r: 'partial_attendance', R: 'partial_attendance',
};

interface ClassItem { id: string; name: string; stream?: string }

export default function AttendanceRegisterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time: refresh attendance when updated from another device
  useSchoolSocket({
    'attendance:updated': () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const dateStr = selectedDate;

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      let data = res.data;
      if (data?.data) data = data.data;
      if (data?.classes) data = data.classes;
      if (data?.result) data = data.result;
      return Array.isArray(data) ? (data as ClassItem[]) : [];
    },
  });

  const filteredClasses = useMemo(() => {
    if (!classesData) return [];
    return Array.isArray(classesData) ? classesData : [];
  }, [classesData]);

  const { data: studentsData } = useQuery({
    queryKey: ['class-students-attendance', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const res = await studentApi.getAll({ classId: selectedClassId });
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedClassId,
  });

  const students = useMemo(() => {
    if (!studentsData) return [];
    const raw = Array.isArray(studentsData) ? studentsData : studentsData.students || [];
    return raw;
  }, [studentsData]);

  useEffect(() => {
    if (students && students.length > 0) {
      const map: Record<string, string> = {};
      const list = Array.isArray(students) ? students : [];
      list.forEach((s: any) => {
        const sid = s.id || s.studentId;
        if (s.photoUrl) map[sid] = s.photoUrl;
      });
      setPhotoMap(prev => ({ ...prev, ...map }));
    }
  }, [students]);

  const { data: existingAttendance } = useQuery({
    queryKey: ['attendance-register', selectedClassId, dateStr],
    queryFn: async () => {
      if (!selectedClassId || !dateStr) return [];
      const res = await attendanceApi.getByClass(selectedClassId, dateStr);
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedClassId && !!dateStr,
  });

  useEffect(() => {
    if (existingAttendance) {
      const map: Record<string, AttendanceStatus> = {};
      const remarks: Record<string, string> = {};
      const records = Array.isArray(existingAttendance) ? existingAttendance : [];
      records.forEach((r: any) => {
        const status = (r.status || '').toLowerCase() as AttendanceStatus;
        if (STATUS_CONFIG[status]) map[r.studentId] = status;
        if (r.remarks) remarks[r.studentId] = r.remarks;
      });
      setAttendanceMap(map);
      setRemarksMap(remarks);
    }
  }, [existingAttendance]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { classId: string; date: string; records: Array<{ studentId: string; status: string; remarks?: string }>; schoolId: string }) => {
      return attendanceApi.createByClass(payload);
    },
    onSuccess: () => {
      setSaveMessage('Saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      queryClient.invalidateQueries({ queryKey: ['attendance-register'] });
    },
    onError: () => {
      setSaveMessage('Error saving attendance!');
      setTimeout(() => setSaveMessage(''), 3000);
    },
  });

  const handleSave = useCallback(async () => {
    if (!selectedClassId || !user?.schoolId) return;
    const records = students.map((s: any) => ({
      studentId: s.id || s.studentId,
      status: attendanceMap[s.id || s.studentId] || 'absent',
      remarks: remarksMap[s.id || s.studentId] || undefined,
    }));
    setSaving(true);
    saveMutation.mutate(
      { classId: selectedClassId, date: dateStr, records, schoolId: user.schoolId },
      { onSettled: () => setSaving(false) },
    );
  }, [selectedClassId, students, attendanceMap, remarksMap, saveMutation, user, dateStr]);

  const setStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setAttendanceMap(prev => ({ ...prev, [studentId]: status }));
  }, []);

  const bulkAction = useCallback((status: AttendanceStatus | 'none') => {
    if (!students) return;
    if (status === 'none') { setAttendanceMap({}); return; }
    const newMap: Record<string, AttendanceStatus> = {};
    students.forEach((s: any) => { newMap[s.id || s.studentId] = status; });
    setAttendanceMap(prev => ({ ...prev, ...newMap }));
  }, [students]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const shortcut = KEYBOARD_SHORTCUTS[e.key];
      if (shortcut) {
        e.preventDefault();
        const firstUnmarked = students.find((s: any) => !attendanceMap[s.id || s.studentId]);
        if (firstUnmarked) setStatus(firstUnmarked.id || firstUnmarked.studentId, shortcut);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [students, attendanceMap, setStatus]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { present: 0, absent: 0, late: 0, excused: 0, sick: 0, suspended: 0, activity: 0, partial_attendance: 0, unmarked: 0 };
    let totalEnrolled = 0, maleEnrolled = 0, femaleEnrolled = 0;
    let totalPresent = 0, malePresent = 0, femalePresent = 0;
    if (!students) return { ...counts, totalEnrolled, maleEnrolled, femaleEnrolled, totalPresent, malePresent, femalePresent };
    students.forEach((s: any) => {
      const sid = s.id || s.studentId;
      const gender = (s.gender || '').toLowerCase();
      totalEnrolled++;
      if (gender === 'male') maleEnrolled++;
      else if (gender === 'female') femaleEnrolled++;
      const status = attendanceMap[sid];
      if (status && counts[status] !== undefined) counts[status]++;
      else counts.unmarked++;
      if (status === 'present') {
        totalPresent++;
        if (gender === 'male') malePresent++;
        else if (gender === 'female') femalePresent++;
      }
    });
    return { ...counts, totalEnrolled, maleEnrolled, femaleEnrolled, totalPresent, malePresent, femalePresent };
  }, [students, attendanceMap]);

  const filteredStudents = useMemo(() => {
    if (!students) return [];
    const list = Array.isArray(students) ? students : [];
    if (filter === 'all') return list;
    if (filter === 'unmarked') return list.filter((s: any) => !attendanceMap[s.id || s.studentId]);
    return list.filter((s: any) => attendanceMap[s.id || s.studentId] === filter);
  }, [students, filter, attendanceMap]);

  const handlePhotoUpload = async (studentId: string, file: File) => {
    setUploadingPhoto(studentId);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      await api.post(`/student/${studentId}/upload-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const blobUrl = URL.createObjectURL(file);
      setPhotoMap(prev => ({ ...prev, [studentId]: blobUrl }));
      queryClient.invalidateQueries({ queryKey: ['class-students-attendance'] });
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const triggerPhotoUpload = (studentId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target?.files?.[0];
      if (file) handlePhotoUpload(studentId, file);
    };
    input.click();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: 40 }}>
      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        .animate-slideDown { animation: slideDown 0.2s ease-out; }
        .status-btn { transition: all 0.15s ease; cursor: pointer; user-select: none; }
        .status-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
        .status-btn:active { transform: translateY(0) scale(0.97); }
        .status-btn.active:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.2); }
        .photo-cell { cursor: pointer; transition: all 0.2s ease; }
        .photo-cell:hover { opacity: 0.85; transform: scale(1.08); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .attendance-row { transition: background 0.15s ease; }
        .attendance-row:hover { background: #faf5ff !important; }
        .attendance-row.unmarked:hover { background: #fffbeb !important; }
        .attendance-row td { transition: all 0.15s ease; }
        @media (max-width: 768px) { .scroll-h { overflow-x: auto; } }
        table.attendance-register { border: 2px solid #94a3b8; border-radius: 0 0 12px 12px; }
        table.attendance-register td, table.attendance-register th { border-right: 1px solid #cbd5e1; }
        table.attendance-register td:last-child, table.attendance-register th:last-child { border-right: none; }
        table.attendance-register thead tr { border-bottom: 2px solid #94a3b8; }
      `}</style>

      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(234,102,69,0.25)' }}>
          <i className="fa fa-clipboard-list" style={{ fontSize: 22, color: 'white' }}></i>
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>Attendance Register</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '2px 0 0' }}>Mark daily student attendance — click photo to upload student passport</p>
        </div>
      </div>

      <div style={{ background: '#fefcf9', borderRadius: 12, border: '2px solid #94a3b8', marginBottom: 20 }}>
        <div style={{ padding: '20px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Class</label>
            <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setAttendanceMap({}); setRemarksMap({}); }}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#fefcf9', color: selectedClassId ? '#0f172a' : '#94a3b8', fontWeight: selectedClassId ? 600 : 400, outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}>
              <option value="">Select Class</option>
              {filteredClasses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}{c.stream ? ` - ${c.stream}` : ''}</option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Date</label>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
          </div>
          <div style={{ minWidth: 150 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Filter</label>
            <select value={filter} onChange={e => setFilter(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, background: '#fefcf9', outline: 'none', cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.target.style.borderColor = '#818cf8'; e.target.style.boxShadow = '0 0 0 3px rgba(129,140,248,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}>
              <option value="all">All Students</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
              <option value="unmarked">Unmarked</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ background: '#fefcf9', borderRadius: 12, border: '2px solid #94a3b8', marginBottom: 20, overflow: 'hidden' }}>
        <div style={{ padding: '12px 20px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', borderBottom: '2px solid #e2e8f0', background: '#fffbeb' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Bulk Mark:</span>
          {BULK_ACTIONS.map(action => (
            <button key={action.label} onClick={() => bulkAction(action.status)}
              style={{
                padding: '5px 14px', fontSize: 11, fontWeight: 700,
                border: action.status === 'none' ? '1.5px solid #d1d5db' : '1.5px solid transparent',
                borderRadius: 6, background: action.bg, color: action.status === 'none' ? '#6b7280' : 'white', cursor: 'pointer',
                transition: 'all 0.15s ease', opacity: 0.9,
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'none'; }}>
              {action.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 20px', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', borderBottom: '2px solid #e2e8f0', background: '#f0fdf4' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Enrolment</span>
          <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '3px 12px', borderRadius: 20 }}>
            Total: <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0 6px' }}>{stats.totalEnrolled}</span>
          </span>
          <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '3px 12px', borderRadius: 20 }}>
            ♂ M: <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0 6px' }}>{stats.maleEnrolled}</span>
          </span>
          <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#9d174d', background: '#fce7f3', padding: '3px 12px', borderRadius: 20 }}>
            ♀ F: <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0 6px' }}>{stats.femaleEnrolled}</span>
          </span>
          <span style={{ width: 1, height: 24, background: '#d1d5db' }}></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#065f46', letterSpacing: '0.3px', textTransform: 'uppercase' }}>Present</span>
          <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#065f46', background: '#d1fae5', padding: '3px 12px', borderRadius: 20 }}>
            Total: <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0 6px' }}>{stats.totalPresent}</span>
          </span>
          <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '3px 12px', borderRadius: 20 }}>
            ♂ M: <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0 6px' }}>{stats.malePresent}</span>
          </span>
          <span style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#9d174d', background: '#fce7f3', padding: '3px 12px', borderRadius: 20 }}>
            ♀ F: <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 4, padding: '0 6px' }}>{stats.femalePresent}</span>
          </span>
        </div>
        <div style={{ padding: '10px 20px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', borderBottom: '2px solid #e2e8f0', background: '#faf5ff' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5b21b6', letterSpacing: '0.3px', textTransform: 'uppercase' }}>By Status</span>
          {Object.entries(stats).map(([key, count]) => {
            if (['present','absent','late','excused','sick','suspended','activity','partial_attendance','unmarked','totalEnrolled','maleEnrolled','femaleEnrolled','totalPresent','malePresent','femalePresent'].includes(key) === false) return null;
            if (count === 0 && key !== 'unmarked') return null;
            const cfg = STATUS_CONFIG[key as AttendanceStatus];
            if (!cfg && key !== 'unmarked') return null;
            const displayLabel = (key === 'unmarked' ? 'Unmarked' : key.charAt(0).toUpperCase() + key.slice(1)).replace('_', ' ');
            const dotColor = key === 'unmarked' ? '#ef4444' : cfg?.dot || '#6b7280';
            const bgColor = key === 'unmarked' ? '#fef2f2' : cfg?.bg || '#f3f4f6';
            const textColor = key === 'unmarked' ? '#dc2626' : cfg?.color || '#374151';
            return (
              <span key={key} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: bgColor }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, animation: key === 'unmarked' ? 'pulse-dot 1.5s ease-in-out infinite' : 'none' }}></span>
                <span style={{ fontWeight: 600, color: textColor }}>{displayLabel}</span>
                <span style={{ fontWeight: 700, color: textColor, background: 'rgba(255,255,255,0.5)', padding: '0 6px', borderRadius: 4, minWidth: 18, textAlign: 'center' }}>{count}</span>
              </span>
            );
          })}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="attendance-register" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
                <th style={{ padding: '14px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', width: 60 }}>Photo</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', width: 40 }}>#</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Student</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Adm No.</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', width: 60 }}>Gender</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }} colSpan={4}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student: any, idx: number) => {
                const sid = student.id || student.studentId;
                const currentStatus = attendanceMap[sid];
                const photoUrl = photoMap[sid];
                const initials = ((student.firstName?.[0] || '') + (student.lastName?.[0] || '')).toUpperCase();
                return (
                  <tr key={sid}
                    className={`attendance-row ${!currentStatus ? 'unmarked' : ''}`}
                    style={{ borderBottom: '1.5px solid #cbd5e1', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <div onClick={() => triggerPhotoUpload(sid)} className="photo-cell" title="Click to upload passport photo"
                        style={{
                          width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: photoUrl ? 'transparent' : '#f3f4f6',
                          border: '2px solid #e8ddd0', margin: '0 auto', position: 'relative',
                        }}>
                        {uploadingPhoto === sid ? (
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>...</span>
                        ) : photoUrl ? (
                          <img src={photoUrl} alt={initials}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                        ) : (
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#9ca3af' }}>{initials || '?'}</span>
                        )}
                        <div style={{
                          position: 'absolute', bottom: -2, right: -2, width: 16, height: 16,
                          borderRadius: '50%', background: '#ea6645', display: 'flex',
                          alignItems: 'center', justifyContent: 'center', border: '2px solid white',
                        }}>
                          <span style={{ color: 'white', fontSize: 8, fontWeight: 700 }}>+</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#9ca3af' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 16px', fontWeight: 600, fontSize: 14, color: '#111827' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {currentStatus && (
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_CONFIG[currentStatus]?.dot || '#9ca3af', flexShrink: 0 }}></span>
                        )}
                        {student.firstName} {student.lastName}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: '#6b7280', fontFamily: 'monospace' }}>{student.admissionNumber || '-'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                        padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: (student.gender || '').toLowerCase() === 'male' ? '#dbeafe' : (student.gender || '').toLowerCase() === 'female' ? '#fce7f3' : '#f3f4f6',
                        color: (student.gender || '').toLowerCase() === 'male' ? '#1e40af' : (student.gender || '').toLowerCase() === 'female' ? '#9d174d' : '#6b7280',
                      }}>
                        {(student.gender || '').toLowerCase() === 'male' ? '♂' : (student.gender || '').toLowerCase() === 'female' ? '♀' : '—'} {student.gender?.[0] || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px' }} colSpan={4}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(Object.entries(STATUS_CONFIG) as [AttendanceStatus, StatusStyle][]).map(([status, cfg]) => {
                          const isActive = currentStatus === status;
                          return (
                            <button key={status} onClick={() => setStatus(sid, status)}
                              className={`status-btn ${isActive ? 'active' : ''}`}
                              style={{
                                padding: '5px 10px', fontSize: 11, fontWeight: isActive ? 700 : 500,
                                border: `1.5px solid ${isActive ? cfg.border : '#e8ddd0'}`,
                                borderRadius: 8, background: isActive ? cfg.activeBg : '#ffffff',
                                color: isActive ? '#ffffff' : cfg.color,
                                cursor: 'pointer', minWidth: 44,
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                justifyContent: 'center',
                                opacity: isActive ? 1 : 0.7,
                              }}
                              title={`${cfg.label} (${Object.entries(KEYBOARD_SHORTCUTS).find(([k, v]) => v === status)?.[0] || ''})`}>
                              <span style={{ fontSize: 13, lineHeight: 1 }}>{cfg.icon}</span>
                              <span>{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <input type="text" value={remarksMap[sid] || ''}
                        onChange={e => setRemarksMap(prev => ({ ...prev, [sid]: e.target.value }))}
                        placeholder="Remarks..."
                        style={{ width: 130, padding: '6px 10px', fontSize: 12, border: '1.5px solid #e8ddd0', borderRadius: 6, background: '#ffffff', color: '#374151', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                        onFocus={e => { e.target.style.borderColor = '#a78bfa'; e.target.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.15)'; }}
                        onBlur={e => { e.target.style.borderColor = '#e8ddd0'; e.target.style.boxShadow = 'none'; }} />
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                    {selectedClassId ? 'No students found for this class' : 'Select a class to begin'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '16px 20px', borderTop: '2px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: '#f8fafc' }}>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, marginRight: 4 }}>⌨️ Keys:</span>
            {[['P','Present'],['A','Absent'],['L','Late'],['X','Excused'],['S','Sick']].map(([key, label]) => (
              <kbd key={key} style={{ padding: '2px 7px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#334155', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>{key}</kbd>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saveMessage && (
              <span style={{ fontSize: 13, padding: '6px 14px', borderRadius: 8,
                color: saveMessage.includes('Error') ? '#dc2626' : '#065f46',
                background: saveMessage.includes('Error') ? '#fef2f2' : '#d1fae5',
                border: `1px solid ${saveMessage.includes('Error') ? '#fecaca' : '#a7f3d0'}`,
                fontWeight: 600, animation: 'slideDown 0.2s ease-out',
              }}>{saveMessage}</span>
            )}
            <button onClick={handleSave} disabled={saving || !selectedClassId}
              style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, border: 'none', borderRadius: 8,
                background: saving ? '#94a3b8' : selectedClassId ? 'linear-gradient(135deg, #ea6645, #f59e0b)' : '#cbd5e1', color: 'white',
                cursor: saving || !selectedClassId ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.3px',
                boxShadow: selectedClassId && !saving ? '0 4px 14px rgba(234,102,69,0.3)' : 'none',
                transition: 'all 0.2s ease', opacity: saving || !selectedClassId ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (selectedClassId && !saving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(234,102,69,0.4)'; }}}
              onMouseLeave={e => { if (selectedClassId && !saving) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(234,102,69,0.3)'; }}}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
