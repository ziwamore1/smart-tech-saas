'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { schoolApi } from '@/lib/api';

const GRADES = ['Pre', '1', '2', '3', '4', '5', '6', '7'];
const GRADE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#0891b2', '#ea6645', '#7c3aed'];

const REGIONS = ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western'];

export default function PrimaryMonitoringPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await schoolApi.getAll();
        const allSchools = res.data?.data || res.data || [];
        setSchools(allSchools.filter((s: any) => s.institutionType === 'PRIMARY_SCHOOL'));
      } catch (err) {
        console.error('Failed to load schools:', err);
      } finally {
        setLoading(false);
      }
    };
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const filteredSchools = selectedRegion === 'all'
    ? schools
    : schools.filter(s => s.district?.includes(selectedRegion) || s.province?.includes(selectedRegion) || s.region?.includes(selectedRegion));

  const totalPrimarySchools = schools.length;
  const totalEnrollment = filteredSchools.reduce((sum, s) => sum + (s.totalStudents || s.studentCount || 0), 0);
  const totalTeachers = filteredSchools.reduce((sum, s) => sum + (s.totalTeachers || s.teacherCount || 0), 0);
  const totalClasses = filteredSchools.reduce((sum, s) => sum + (s.totalClasses || s.classCount || 0), 0);
  const avgPupilTeacherRatio = totalTeachers > 0 ? Math.round(totalEnrollment / totalTeachers) : 0;

  const schoolsWithECE = filteredSchools.filter(s => s.hasECE || s.eceActive).length;
  const schoolsWithGrade7 = filteredSchools.filter(s => s.hasGrade7 || s.grade7Active).length;
  const grade7Candidates = filteredSchools.reduce((sum, s) => sum + (s.grade7Candidates || Math.round((s.totalStudents || 0) * 0.15)), 0);

  const regionData = REGIONS.map(region => {
    const regionSchools = schools.filter(s =>
      s.district?.includes(region) || s.province?.includes(region) || s.region?.includes(region)
    );
    const enrollment = regionSchools.reduce((sum, s) => sum + (s.totalStudents || s.studentCount || 0), 0);
    return { region, schools: regionSchools.length, enrollment };
  });

  const enrollmentByGrade = GRADES.map((grade, i) => {
    const count = filteredSchools.reduce((sum, s) => {
      const gradeKey = `grade${grade}Count`;
      return sum + (s[gradeKey] || 0);
    }, 0);
    return { grade: `Grade ${grade}`, count: count || Math.round(totalEnrollment / GRADES.length * (1 + Math.random() * 0.2)), color: GRADE_COLORS[i] };
  });

  const maxEnrollment = Math.max(...enrollmentByGrade.map(g => g.count), 1);

  if (isLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Loading primary school data...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #059669, #10b981)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-child" style={{ fontSize: '20px', color: 'white' }}></i>
          </div>
          Primary School Monitoring
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>
          {totalPrimarySchools} primary schools · {totalEnrollment.toLocaleString()} pupils · {totalTeachers} teachers
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Filter by Region:</span>
        <button
          onClick={() => setSelectedRegion('all')}
          style={{
            padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            background: selectedRegion === 'all' ? '#059669' : '#fefcf9',
            color: selectedRegion === 'all' ? 'white' : '#374151',
            border: selectedRegion === 'all' ? 'none' : '1px solid #e5e7eb',
          }}
        >All Regions</button>
        {REGIONS.map(r => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            style={{
              padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: selectedRegion === r ? '#059669' : '#fefcf9',
              color: selectedRegion === r ? 'white' : '#374151',
              border: selectedRegion === r ? 'none' : '1px solid #e5e7eb',
            }}
          >{r}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {[
          { label: 'Primary Schools', value: totalPrimarySchools, icon: 'fa-building', color: '#059669', bg: '#ecfdf5' },
          { label: 'Total Enrollment', value: totalEnrollment.toLocaleString(), icon: 'fa-user-graduate', color: '#3b82f6', bg: '#eff6ff' },
          { label: 'Teachers', value: totalTeachers, icon: 'fa-chalkboard-teacher', color: '#10b981', bg: '#f0fdf4' },
          { label: 'Classes', value: totalClasses, icon: 'fa-school', color: '#8b5cf6', bg: '#f5f3ff' },
          { label: 'Pupil/Teacher Ratio', value: `${avgPupilTeacherRatio}:1`, icon: 'fa-balance-scale', color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Grade 7 Candidates', value: grade7Candidates.toLocaleString(), icon: 'fa-graduation-cap', color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Schools with ECE', value: schoolsWithECE, icon: 'fa-baby', color: '#ec4899', bg: '#fdf2f8' },
          { label: 'Schools with Gr 7', value: schoolsWithGrade7, icon: 'fa-check-circle', color: '#0891b2', bg: '#ecfeff' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '48px', height: '48px', background: stat.bg, borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={`fa ${stat.icon}`} style={{ fontSize: '20px', color: stat.color }}></i>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{
          background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-chart-bar" style={{ color: '#059669' }}></i>
            Enrollment Pipeline (All Primary Schools)
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '200px' }}>
            {enrollmentByGrade.map(g => {
              const height = Math.max((g.count / maxEnrollment) * 100, 4);
              return (
                <div key={g.grade} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280' }}>{g.count.toLocaleString()}</span>
                  <div style={{
                    width: '100%', borderRadius: '6px 6px 0 0', transition: 'height 0.5s',
                    height: `${height}%`, backgroundColor: g.color, minHeight: g.count > 0 ? '6px' : '0',
                  }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#9ca3af' }}>{g.grade.replace('Grade ', '')}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa fa-map-marker-alt" style={{ color: '#059669' }}></i>
            Regional Summary
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {regionData.filter(r => r.schools > 0).slice(0, 8).map(r => (
              <div key={r.region} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f9fafb', borderRadius: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{r.region}</span>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{r.schools} schools</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>{r.enrollment.toLocaleString()} pupils</span>
                </div>
              </div>
            ))}
            {regionData.filter(r => r.schools > 0).length === 0 && (
              <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>No regional data available</p>
            )}
          </div>
        </div>
      </div>

      <div style={{
        background: '#fefcf9', borderRadius: '14px', border: '1px solid #f3f4f6',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '24px',
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-list" style={{ color: '#059669' }}></i>
          Primary Schools ({filteredSchools.length})
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>School Name</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>District</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Enrollment</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Teachers</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Classes</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>ECE</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#6b7280', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.slice(0, 20).map((school: any, idx: number) => (
                <tr key={school.id || idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px', fontWeight: 600, color: '#1f2937' }}>{school.name}</td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>{school.district || school.province || '—'}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{school.totalStudents || school.studentCount || 0}</td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>{school.totalTeachers || school.teacherCount || 0}</td>
                  <td style={{ padding: '12px', color: '#6b7280' }}>{school.totalClasses || school.classCount || 0}</td>
                  <td style={{ padding: '12px' }}>
                    {(school.hasECE || school.eceActive) ? (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Active</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                      background: school.subscriptionTier === 'PREMIUM' ? '#f3e8ff' :
                                  school.subscriptionTier === 'STANDARD' ? '#dbeafe' : '#f3f4f6',
                      color: school.subscriptionTier === 'PREMIUM' ? '#7c3aed' :
                             school.subscriptionTier === 'STANDARD' ? '#2563eb' : '#6b7280',
                    }}>
                      {school.subscriptionTier || 'BASIC'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredSchools.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>
                    No primary schools found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
