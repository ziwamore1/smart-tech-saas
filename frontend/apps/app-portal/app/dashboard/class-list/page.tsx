'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, classApi, studentApi, academicYearApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function exportToCSV(rows: Array<Record<string, any>>, filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(h => {
        const val = row[h]?.toString() || '';
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClassListPage() {
  const { user } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [downloading, setDownloading] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      return res.data?.data || res.data || [];
    },
  });

  const { data: yearsData } = useQuery({
    queryKey: ['academic-years'],
    queryFn: async () => {
      const res = await academicYearApi.getAll();
      return res.data?.data || res.data || [];
    },
  });

  const classes = useMemo(() => {
    return Array.isArray(classesData) ? classesData : [];
  }, [classesData]);

  const years = useMemo(() => {
    return Array.isArray(yearsData) ? yearsData : [];
  }, [yearsData]);

  const selectedClass = useMemo(() => {
    return classes.find((c: any) => c.id === selectedClassId) || null;
  }, [classes, selectedClassId]);

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ['class-students-list', selectedClassId],
    queryFn: async () => {
      if (!selectedClassId) return [];
      const res = await studentApi.getAll({ classId: selectedClassId });
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedClassId,
  });

  type StudentRow = { id: string; admissionNumber: string; firstName: string; lastName: string; fullName: string; gender: string; dateOfBirth: string | null; age: number | null; status: string };

  const students = useMemo<StudentRow[]>(() => {
    if (!studentsData) return [];
    const raw = Array.isArray(studentsData) ? studentsData : (studentsData.students || []);
    return raw.map((s: any) => ({
      id: s.id || s.studentId,
      admissionNumber: s.admissionNumber || '-',
      firstName: s.firstName || '',
      lastName: s.lastName || '',
      fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
      gender: s.gender || 'Not Specified',
      dateOfBirth: s.dateOfBirth || null,
      age: s.dateOfBirth ? calculateAge(s.dateOfBirth) : null,
      status: s.enrollments?.[0]?.status || 'ACTIVE',
    }));
  }, [studentsData]);

  const filteredStudents = useMemo(() => {
    let list = students;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((s: { fullName: string; admissionNumber: string }) =>
        s.fullName.toLowerCase().includes(term) ||
        s.admissionNumber.toLowerCase().includes(term)
      );
    }
    if (genderFilter !== 'all') {
      list = list.filter(s => s.gender?.toLowerCase() === genderFilter.toLowerCase());
    }
    return list;
  }, [students, searchTerm, genderFilter]);

  const genderSummary = useMemo(() => {
    const male = students.filter(s => s.gender?.toLowerCase() === 'male' || s.gender === 'M').length;
    const female = students.filter(s => s.gender?.toLowerCase() === 'female' || s.gender === 'F').length;
    const unspecified = students.filter(s =>
      s.gender && !['male', 'female', 'm', 'f'].includes(s.gender.toLowerCase())
    ).length;
    const unknown = students.filter(s => !s.gender || s.gender === 'Not Specified').length;
    return { male, female, unspecified, unknown, total: students.length };
  }, [students]);

  const csvData = useMemo(() => {
    return filteredStudents.map((s, i) => ({
      '#': i + 1,
      'Admission No': s.admissionNumber,
      'First Name': s.firstName,
      'Last Name': s.lastName,
      'Gender': s.gender,
      'Date of Birth': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '-',
      'Age': s.age !== null ? s.age : '-',
      'Status': s.status,
    }));
  }, [filteredStudents]);

  const handleDownloadPdf = async () => {
    if (!selectedClassId || !user?.schoolId) return;
    setDownloading(true);
    try {
      const response = await api.get(`/attendance/class-list/${selectedClassId}/pdf`, {
        params: { schoolId: user.schoolId },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Class_List_${selectedClass?.name?.replace(/\s+/g, '_') || 'Report'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('PDF download failed:', err);
      alert('Failed to generate PDF. Please ensure the report service is running.');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportExcel = () => {
    const filename = `Class_List_${selectedClass?.name || 'All'}`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    exportToCSV(csvData, filename);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', paddingBottom: 40 }}>
      <style>{`
        .card-hover { transition: all 0.2s ease; }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.08); }
        .class-list-table { border: 1px solid #d1d5db; }
        .class-list-table th { border-bottom: 2px solid #d1d5db; background: #f3f4f6; color: #374151; font-size: 11px; text-transform: uppercase; }
        .class-list-table td, .class-list-table th { border-right: 1px solid #e8ddd0; padding: 10px 14px; }
        .class-list-table td:last-child, .class-list-table th:last-child { border-right: none; }
        .class-list-table tr { border-bottom: 1px solid #e8ddd0; }
        .class-list-table tr:last-child { border-bottom: none; }
      `}</style>

      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1f2937', margin: 0 }}>Class List</h1>
          <p style={{ color: '#6b7280', fontSize: 14, margin: '4px 0 0' }}>View and export student class lists with gender breakdown</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDownloadPdf} disabled={downloading || !selectedClassId}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 8, background: '#fefcf9', color: downloading ? '#9ca3af' : '#374151', cursor: downloading || !selectedClassId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa fa-file-pdf" style={{ color: '#dc2626' }}></i>
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button onClick={handleExportExcel}
            style={{ padding: '10px 20px', fontSize: 13, fontWeight: 600, border: '1px solid #d1d5db', borderRadius: 8, background: '#fefcf9', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa fa-file-excel" style={{ color: '#059669' }}></i>
            Export Excel
          </button>
        </div>
      </div>

      <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Class</label>
            <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSearchTerm(''); }}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fefcf9' }}
            >
              <option value="">Select Class</option>
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.stream ? ` - ${c.stream}` : ''}{c.levelType?.name ? ` (${c.levelType.name})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Search</label>
            <input
              type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Name or Admission No..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
            />
          </div>
          <div style={{ minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Gender</label>
            <select value={genderFilter} onChange={e => setGenderFilter(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, background: '#fefcf9' }}
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div style={{ minWidth: 100 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>&nbsp;</label>
            <div style={{ fontSize: 13, color: '#6b7280', padding: '8px 0' }}>
              {filteredStudents.length} / {students.length} students
            </div>
          </div>
        </div>
      </div>

      {!selectedClassId ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0' }}>
          <p style={{ fontSize: 48, margin: '0 0 12px' }}>📋</p>
          <p style={{ fontSize: 16, fontWeight: 500 }}>Select a class to view the student list</p>
        </div>
      ) : isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0' }}>
          Loading students...
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Students', value: genderSummary.total, color: '#1f2937', bg: '#f3f4f6', icon: '👥' },
              { label: 'Male', value: genderSummary.male, color: '#2563eb', bg: '#eff6ff', icon: '♂' },
              { label: 'Female', value: genderSummary.female, color: '#db2777', bg: '#fdf2f8', icon: '♀' },
              { label: 'Capacity', value: selectedClass?.capacity || '-', color: '#6b7280', bg: '#f5efe8', icon: '📊' },
            ].map(card => (
              <div key={card.label} className="card-hover" style={{ background: card.bg, borderRadius: 10, border: '1px solid #e8ddd0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{card.icon}</span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 2px' }}>{card.label}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: card.color, margin: 0 }}>{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', marginBottom: 16, padding: '12px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
            <span><strong>Class:</strong> {selectedClass?.name}{selectedClass?.stream ? ` - ${selectedClass.stream}` : ''}</span>
            {selectedClass?.levelType?.name && <span><strong>Level:</strong> {selectedClass.levelType.name}</span>}
            <span><strong>Capacity:</strong> {selectedClass?.capacity || 'Unlimited'}</span>
            <span><strong>Male:</strong> {genderSummary.male}</span>
            <span><strong>Female:</strong> {genderSummary.female}</span>
            <span><strong>Total:</strong> {genderSummary.total}</span>
            {genderSummary.total > 0 && (
              <span><strong>M:F Ratio:</strong> {genderSummary.male}:{genderSummary.female} ({(genderSummary.male / genderSummary.total * 100).toFixed(0)}% / {(genderSummary.female / genderSummary.total * 100).toFixed(0)}%)</span>
            )}
          </div>

          <div style={{ background: '#fefcf9', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="class-list-table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', width: 40 }}>#</th>
                    <th style={{ textAlign: 'left' }}>Admission No</th>
                    <th style={{ textAlign: 'left' }}>Full Name</th>
                    <th style={{ textAlign: 'center' }}>Gender</th>
                    <th style={{ textAlign: 'left' }}>Date of Birth</th>
                    <th style={{ textAlign: 'center' }}>Age</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s, idx) => (
                    <tr key={s.id}>
                      <td style={{ color: '#9ca3af', fontSize: 12 }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600, color: '#374151', fontSize: 12 }}>{s.admissionNumber}</td>
                      <td style={{ fontWeight: 500, color: '#1f2937' }}>{s.fullName}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                          color: s.gender?.toLowerCase() === 'male' || s.gender === 'M' ? '#2563eb'
                            : s.gender?.toLowerCase() === 'female' || s.gender === 'F' ? '#db2777'
                            : '#6b7280',
                          background: s.gender?.toLowerCase() === 'male' || s.gender === 'M' ? '#eff6ff'
                            : s.gender?.toLowerCase() === 'female' || s.gender === 'F' ? '#fdf2f8'
                            : '#f3f4f6',
                        }}>
                          {s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : s.gender || '-'}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280', fontSize: 12 }}>
                        {s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </td>
                      <td style={{ textAlign: 'center', color: '#374151', fontWeight: 500 }}>{s.age !== null ? s.age : '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                          color: s.status === 'ACTIVE' ? '#059669' : '#dc2626',
                          background: s.status === 'ACTIVE' ? '#f0fdf4' : '#fef2f2',
                        }}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && (
              <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                {searchTerm || genderFilter !== 'all'
                  ? 'No students match your search criteria'
                  : 'No students enrolled in this class'}
              </div>
            )}

            <div style={{ padding: '12px 20px', borderTop: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#6b7280' }}>
              <span>Showing {filteredStudents.length} of {students.length} students</span>
              <span style={{ display: 'flex', gap: 16 }}>
                <span>♂ Male: {genderSummary.male}</span>
                <span>♀ Female: {genderSummary.female}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
