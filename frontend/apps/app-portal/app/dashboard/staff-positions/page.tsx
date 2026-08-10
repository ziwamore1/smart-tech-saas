'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { staffPositionApi } from '@/lib/api';
import { ReadOnlyBanner } from '@/components/permissions/ReadOnlyBanner';

type AdminRole = 'Director' | 'SuperAdmin' | 'Deputy Director' | 'Head Teacher' | 'Deputy Head' | 'Deputy' | 'HOD' | 'Lower Primary Senior Teacher' | 'Upper Primary Senior Teacher';
const ADMIN_ROLES: AdminRole[] = ['Director', 'SuperAdmin', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'Deputy', 'HOD', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];

const getSupervisorLabel = (posType: string) => {
  if (posType === 'LOWER_PRIMARY_SENIOR_TEACHER') return 'Lower Primary Senior Teacher';
  if (posType === 'UPPER_PRIMARY_SENIOR_TEACHER') return 'Upper Primary Senior Teacher';
  return 'HOD';
};

export default function StaffPositionsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'departments' | 'positions' | 'hierarchy'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [hierarchy, setHierarchy] = useState<any>(null);
  const [positionTypes, setPositionTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r: string) => ADMIN_ROLES.includes(r as AdminRole));
  const isDirector = userRoles.includes('Director') || userRoles.includes('SuperAdmin');

  const handleSync = async () => {
    setSyncing(true); setError(null); setSuccess(null);
    try {
      const res = await staffPositionApi.forceSync();
      const data = res.data?.data || res.data || {};
      if (data.running) {
        setSuccess(data.message || 'Sync already in progress');
      } else {
        setSuccess(
          `Sync complete: ${data.teachersScanned ?? 0} staff scanned, ` +
          `${data.teachersLinked ?? 0} staff linked to departments, ` +
          `${data.positionsCreated ?? 0} positions created`
        );
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Sync failed');
    } finally {
      setSyncing(false);
      fetchData();
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    const [deptsRes, posRes, typesRes] = await Promise.allSettled([
      staffPositionApi.getDepartments(),
      staffPositionApi.getPositions(),
      staffPositionApi.getPositionTypes(),
    ]);
    const failures: string[] = [];
    if (deptsRes.status === 'fulfilled') setDepartments(deptsRes.value.data?.data || deptsRes.value.data || []);
    else failures.push(`departments: ${(deptsRes.reason as any)?.response?.data?.message || (deptsRes.reason as any)?.message || deptsRes.reason}`);
    if (posRes.status === 'fulfilled') setPositions(posRes.value.data?.data || posRes.value.data || []);
    else failures.push(`positions: ${(posRes.reason as any)?.response?.data?.message || (posRes.reason as any)?.message || posRes.reason}`);
    if (typesRes.status === 'fulfilled') setPositionTypes(typesRes.value.data?.data || typesRes.value.data || []);
    else failures.push(`position types: ${(typesRes.reason as any)?.response?.data?.message || (typesRes.reason as any)?.message || typesRes.reason}`);
    if (failures.length) setError(`Failed to load: ${failures.join('; ')}`);
    setLoading(false);
  }, []);

  const fetchHierarchy = useCallback(async () => {
    try {
      const res = await staffPositionApi.getHierarchy();
      setHierarchy(res.data?.data || res.data);
    } catch { }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/login'); return; }
    if (!authLoading) fetchData();
  }, [authLoading, isAuthenticated, fetchData, router]);

  useEffect(() => {
    if (activeTab === 'hierarchy') fetchHierarchy();
  }, [activeTab, fetchHierarchy]);

  if (authLoading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><div style={{ width: 40, height: 40, border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div></div>;

  if (!isAdmin) {
    return <div style={{ padding: 40, textAlign: 'center' }}><h2 style={{ fontSize: 20, fontWeight: 600, color: '#dc2626' }}>Access Denied</h2><p style={{ color: '#6b7280', marginTop: 8 }}>Only administrative roles can access staff positions.</p></div>;
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <ReadOnlyBanner managePermission="staff.manage" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>Staff Positions & Departments</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Manage departments, acting positions, and organizational hierarchy</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: '8px 16px', background: syncing ? '#f3c3b8' : '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 13 }}
          >
            <i className="fas fa-sync" style={{ marginRight: 6 }}></i>{syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 16, color: '#dc2626', fontSize: 14 }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16, color: '#16a34a', fontSize: 14 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e8ddd0', marginBottom: 24, overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('departments')} style={{ padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === 'departments' ? 600 : 400, color: activeTab === 'departments' ? '#ea6645' : '#6b7280', borderBottom: activeTab === 'departments' ? '2px solid #ea6645' : '2px solid transparent', marginBottom: -2 }}><i className="fas fa-building" style={{ marginRight: 6 }}></i>Departments</button>
        <button onClick={() => setActiveTab('positions')} style={{ padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === 'positions' ? 600 : 400, color: activeTab === 'positions' ? '#ea6645' : '#6b7280', borderBottom: activeTab === 'positions' ? '2px solid #ea6645' : '2px solid transparent', marginBottom: -2 }}><i className="fas fa-user-tag" style={{ marginRight: 6 }}></i>Acting Positions</button>
        <button onClick={() => setActiveTab('hierarchy')} style={{ padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: activeTab === 'hierarchy' ? 600 : 400, color: activeTab === 'hierarchy' ? '#ea6645' : '#6b7280', borderBottom: activeTab === 'hierarchy' ? '2px solid #ea6645' : '2px solid transparent', marginBottom: -2 }}><i className="fas fa-sitemap" style={{ marginRight: 6 }}></i>Hierarchy</button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Loading...</p>
        </div>
      )}

      {!loading && activeTab === 'departments' && (
        <DepartmentsTab
          departments={departments}
          isDirector={isDirector}
          onRefresh={fetchData}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}

      {!loading && activeTab === 'positions' && (
        <PositionsTab
          positions={positions}
          departments={departments}
          positionTypes={positionTypes}
          isDirector={isDirector}
          onRefresh={fetchData}
          setSuccess={setSuccess}
          setError={setError}
        />
      )}

      {!loading && activeTab === 'hierarchy' && (
        <HierarchyTab hierarchy={hierarchy} departments={departments} onRefresh={fetchHierarchy} />
      )}
    </div>
  );
}

function DepartmentsTab({ departments, isDirector, onRefresh, setSuccess, setError }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  const CATEGORIES = [
    'MATHEMATICS', 'SCIENCE', 'LANGUAGES', 'SOCIAL_SCIENCE', 'COMPUTER_SCIENCE',
    'BUSINESS_STUDIES', 'TECHNICAL', 'VOCATIONAL', 'CREATIVE_ARTS', 'SPORTS',
    'COUNSELING', 'ADMINISTRATION', 'FINANCE', 'LIBRARY', 'EARLY_CHILDHOOD',
    'LOWER_PRIMARY', 'UPPER_PRIMARY', 'SPECIAL_EDUCATION', 'LITERACY_NUMERACY',
  ];

  const resetForm = () => {
    setName(''); setCode(''); setCategory(''); setDescription(''); setEditDept(null); setShowForm(false);
  };

  const handleEdit = (dept: any) => {
    setEditDept(dept); setName(dept.name); setCode(dept.code || '');
    setCategory(dept.category); setDescription(dept.description || ''); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!name || !category) return;
    try {
      if (editDept) {
        await staffPositionApi.updateDepartment(editDept.id, { name, code, category, description });
        setSuccess('Department updated');
      } else {
        await staffPositionApi.createDepartment({ name, code, category, description });
        setSuccess('Department created');
      }
      resetForm(); onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save department');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this department? This cannot be undone if teachers are assigned.')) return;
    try {
      await staffPositionApi.deleteDepartment(id);
      setSuccess('Department deleted');
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Departments ({departments.length})</h3>
        {isDirector && (
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: '8px 16px', background: '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Add Department
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editDept ? 'Edit Department' : 'New Department'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mathematics" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Code</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. MATH" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSubmit} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>{editDept ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {departments.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 40, textAlign: 'center', color: '#6b7280' }}>
          No departments are currently linked from the Staff Register. {isDirector && 'Create a department first, then assign staff during registration.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {departments.map((dept: any) => (
            <div key={dept.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e' }}>{dept.name}</h4>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {dept.code && <span style={{ fontFamily: 'monospace', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, marginRight: 6 }}>{dept.code}</span>}
                    {dept.category?.replace(/_/g, ' ')}
                  </div>
                </div>
                {isDirector && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => handleEdit(dept)} style={{ padding: '4px 8px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
                    <button onClick={() => handleDelete(dept.id)} style={{ padding: '4px 8px', background: '#fecaca', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Del</button>
                  </div>
                )}
              </div>
              {dept.description && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{dept.description}</p>}
              <div style={{ marginTop: 10, padding: '8px 10px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#059669' }}>
                <i className="fas fa-user-tie" style={{ marginRight: 5 }}></i>
                {dept.hod?.teacher?.user ? <>HOD: {dept.hod.teacher.user.firstName} {dept.hod.teacher.user.lastName}</> : 'HOD is recognized automatically from Staff Register roles'}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 12, color: '#6b7280' }}>
                <span><strong style={{ color: '#374151' }}>{dept._count?.teachers || 0}</strong> registered staff</span>
                <span><strong style={{ color: '#374151' }}>{dept._count?.positions || 0}</strong> positions</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PositionsTab({ positions, departments, positionTypes, isDirector, onRefresh, setSuccess, setError }: any) {
  const [showForm, setShowForm] = useState(false);
  const [editPos, setEditPos] = useState<any>(null);
  const [teacherId, setTeacherId] = useState('');
  const [positionType, setPositionType] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [classId, setClassId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        const { teacherApi } = await import('@/lib/api');
        const res = await teacherApi.getAll();
        setTeachers(res.data?.data || res.data || []);
      } catch { }
    };
    loadTeachers();
  }, []);

  const resetForm = () => {
    setTeacherId(''); setPositionType(''); setDepartmentId(''); setClassId('');
    setIsPrimary(true); setEditPos(null); setShowForm(false);
  };

  const handleEdit = (pos: any) => {
    setEditPos(pos); setTeacherId(pos.teacherId); setPositionType(pos.positionType);
    setDepartmentId(pos.departmentId || ''); setClassId(pos.classId || '');
    setIsPrimary(pos.isPrimary ?? true); setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!teacherId || !positionType) return;
    try {
      const payload: any = { teacherId, positionType, isPrimary };
      if (departmentId) payload.departmentId = departmentId;
      if (classId) payload.classId = classId;

      if (editPos) {
        await staffPositionApi.updatePosition(editPos.id, payload);
        setSuccess('Position updated');
      } else {
        await staffPositionApi.createPosition(payload);
        setSuccess('Position created');
      }
      resetForm(); onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save position');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this position assignment?')) return;
    try {
      await staffPositionApi.deletePosition(id);
      setSuccess('Position deleted');
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to delete');
    }
  };

  const positionTypeLabels: Record<string, string> = {
    DIRECTOR: 'Director', DEPUTY_DIRECTOR: 'Deputy Director',
    HEAD_TEACHER: 'Head Teacher', DEPUTY: 'Deputy', HOD: 'Head of Department',
    SUBJECT_TEACHER: 'Subject Teacher', CLASS_TEACHER: 'Class Teacher',
    SENIOR_TEACHER: 'Senior Teacher', ADMINISTRATOR: 'Administrator',
    LOWER_PRIMARY_SENIOR_TEACHER: 'Lower Primary Senior Teacher',
    UPPER_PRIMARY_SENIOR_TEACHER: 'Upper Primary Senior Teacher',
  };

  const getTeacherName = (pos: any) => {
    const name = pos.teacher?.user?.firstName || pos.teacher?.firstName || '';
    const lastName = pos.teacher?.user?.lastName || pos.teacher?.lastName || '';
    return `${name} ${lastName}`.trim() || pos.teacherId?.slice(0, 8);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Acting Positions ({positions.length})</h3>
        {isDirector && (
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{ padding: '8px 16px', background: '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            <i className="fas fa-plus" style={{ marginRight: 6 }}></i>Assign Position
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editPos ? 'Edit Position' : 'Assign Position'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Teacher *</label>
              <select value={teacherId} onChange={e => setTeacherId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                <option value="">Select teacher</option>
                {teachers.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.user?.firstName} {t.user?.lastName} ({t.employeeNo || t.id?.slice(0, 8)})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Position Type *</label>
              <select value={positionType} onChange={e => setPositionType(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                <option value="">Select type</option>
                {positionTypes.map((pt: any) => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Department (for HOD)</label>
              <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                <option value="">None</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#374151', display: 'block', marginBottom: 4 }}>Primary Position</label>
              <div style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                <label style={{ fontSize: 13 }}><input type="radio" checked={isPrimary} onChange={() => setIsPrimary(true)} /> Primary</label>
                <label style={{ fontSize: 13 }}><input type="radio" checked={!isPrimary} onChange={() => setIsPrimary(false)} /> Additional</label>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleSubmit} disabled={!teacherId || !positionType} style={{ padding: '8px 16px', background: teacherId && positionType ? '#059669' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 6, cursor: teacherId && positionType ? 'pointer' : 'not-allowed', fontSize: 13 }}>{editPos ? 'Update' : 'Assign'}</button>
            <button onClick={resetForm} style={{ padding: '8px 16px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {positions.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 40, textAlign: 'center', color: '#6b7280' }}>
          No positions assigned. {isDirector && 'Click "Assign Position" to create one.'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9f5f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Teacher</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Position</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Department</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {positions
                  .sort((a: any, b: any) => {
                    const typeOrder = ['DIRECTOR', 'DEPUTY_DIRECTOR', 'HEAD_TEACHER', 'DEPUTY', 'HOD', 'LOWER_PRIMARY_SENIOR_TEACHER', 'UPPER_PRIMARY_SENIOR_TEACHER', 'SUBJECT_TEACHER', 'CLASS_TEACHER', 'SENIOR_TEACHER', 'ADMINISTRATOR'];
                    return typeOrder.indexOf(a.positionType) - typeOrder.indexOf(b.positionType);
                  })
                  .map((pos: any) => (
                    <tr key={pos.id} style={{ borderTop: '1px solid #f3eee8' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{getTeacherName(pos)}</td>
                      <td style={{ padding: '10px 14px' }}><PositionBadge type={pos.positionType} label={positionTypeLabels[pos.positionType] || pos.positionType} /></td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{pos.department?.name || '-'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>{pos.isPrimary ? <span style={{ color: '#059669' }}>Primary</span> : <span style={{ color: '#6b7280' }}>Additional</span>}</td>
                      <td style={{ padding: '10px 14px' }}><StatusBadge status={pos.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
                      <td style={{ padding: '10px 14px' }}>
                        {isDirector && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => handleEdit(pos)} style={{ padding: '3px 8px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
                            <button onClick={() => handleDelete(pos.id)} style={{ padding: '3px 8px', background: '#fecaca', color: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Del</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function HierarchyTab({ hierarchy, departments, onRefresh }: any) {
  if (!hierarchy) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading hierarchy...</div>;
  }

  return (
    <div>
      <button onClick={onRefresh} style={{ padding: '8px 16px', background: '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginBottom: 16, fontSize: 13 }}>
        <i className="fas fa-sync" style={{ marginRight: 6 }}></i>Refresh
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 16 }}>
        {/* Leadership Card */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1a1a2e' }}>
            <i className="fas fa-crown" style={{ color: '#f59e0b', marginRight: 8 }}></i>School Leadership
          </h3>

          {hierarchy.director ? (
            <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Director</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{hierarchy.director.teacher?.user?.firstName} {hierarchy.director.teacher?.user?.lastName}</div>
            </div>
          ) : null}

          {hierarchy.deputyDirector?.length > 0 ? (
            hierarchy.deputyDirector.map((d: any) => (
              <div key={d.id} style={{ padding: '6px 12px', background: '#dbeafe', borderRadius: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>Deputy Director</div>
                <div style={{ fontSize: 13 }}>{d.teacher?.user?.firstName} {d.teacher?.user?.lastName}</div>
              </div>
            ))
          ) : null}

          {hierarchy.headTeacher ? (
            <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 8, marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Head Teacher</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{hierarchy.headTeacher.teacher?.user?.firstName} {hierarchy.headTeacher.teacher?.user?.lastName}</div>
            </div>
          ) : null}

          {hierarchy.deputies?.length > 0 ? (
            hierarchy.deputies.map((d: any) => (
              <div key={d.id} style={{ padding: '6px 12px', background: '#f3f4f6', borderRadius: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Deputy</div>
                <div style={{ fontSize: 13 }}>{d.teacher?.user?.firstName} {d.teacher?.user?.lastName}</div>
              </div>
            ))
          ) : null}

          {!hierarchy.director && !hierarchy.headTeacher && !hierarchy.deputyDirector?.length && !hierarchy.deputies?.length && (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>No leadership assigned</div>
          )}
        </div>

        {/* Departments Overview */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#1a1a2e' }}>
            <i className="fas fa-sitemap" style={{ color: '#3b82f6', marginRight: 8 }}></i>Departments Overview
          </h3>
          {hierarchy.departments?.length > 0 ? (
            hierarchy.departments.map((dept: any) => (
              <div key={dept.department.id} style={{ padding: '8px 12px', borderBottom: '1px solid #f3eee8', marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{dept.department.name}</span>
                  <span style={{ fontSize: 11, color: '#6b7280' }}>{dept.members.length} teachers</span>
                </div>
                {dept.hod ? (
                  <div style={{ fontSize: 12, color: '#059669', marginTop: 2 }}>
                    <i className="fas fa-user-tie" style={{ marginRight: 4 }}></i>
                    {getSupervisorLabel(dept.hod.positionType)}: {dept.hod.teacher?.user?.firstName} {dept.hod.teacher?.user?.lastName}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>No supervisor assigned</div>
                )}
              </div>
            ))
          ) : <div style={{ color: '#9ca3af', fontSize: 13 }}>No departments with teachers</div>}
        </div>

        {/* Monitoring Chain Legend */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: '#92400e' }}>
            <i className="fas fa-info-circle" style={{ marginRight: 8 }}></i>Monitoring Hierarchy
          </h3>
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
            <p><strong>Director</strong> → Supervises all staff (secondary/advanced secondary)</p>
            <p><strong>Deputy Director</strong> → Supervises HODs, Senior Teachers, and Subject Teachers</p>
            <p><strong>Head Teacher</strong> → Supervises all staff (primary)</p>
            <p><strong>Deputy</strong> → Supervises HODs, Senior Teachers, Subject Teachers (primary)</p>
            <p><strong>HOD</strong> → Supervises teachers in their department (secondary)</p>
            <p><strong>Lower Primary Senior Teacher</strong> → Supervises Lower Primary Class Teachers</p>
            <p><strong>Upper Primary Senior Teacher</strong> → Supervises Upper Primary Class Teachers</p>
            <p><strong>Subject Teacher</strong> → Reports to HOD / Deputy Director</p>
            <p><strong>Class Teacher</strong> → Additional responsibility for a class</p>
          </div>
        </div>
      </div>

      {/* Detailed Department View */}
      {hierarchy.departments?.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Department Details</h3>
          {hierarchy.departments.map((dept: any) => (
            <div key={dept.department.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                  {dept.department.name}
                  {dept.department.code && <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', marginLeft: 6 }}>{dept.department.code}</span>}
                </h4>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{dept.members.length} teacher{dept.members.length !== 1 ? 's' : ''}</span>
              </div>
              {dept.hod && (
                <div style={{ padding: '6px 10px', background: '#f0fdf4', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
                  <i className="fas fa-user-tie" style={{ color: '#059669', marginRight: 6 }}></i>
                  <strong>{getSupervisorLabel(dept.hod.positionType)}:</strong> {dept.hod.teacher?.user?.firstName} {dept.hod.teacher?.user?.lastName}
                </div>
              )}
              {dept.members.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {dept.members.map((m: any) => (
                    <div key={m.id} style={{ padding: '4px 10px', background: '#f3f4f6', borderRadius: 6, fontSize: 12 }}>
                      {m.user?.firstName} {m.user?.lastName}
                      {m.positions?.some((p: any) => p.positionType === 'CLASS_TEACHER') && (
                        <span style={{ color: '#3b82f6', marginLeft: 4 }}>(CT)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PositionBadge({ type, label }: { type: string; label: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    DIRECTOR: { bg: '#fef3c7', text: '#92400e' },
    DEPUTY_DIRECTOR: { bg: '#dbeafe', text: '#1d4ed8' },
    HEAD_TEACHER: { bg: '#fef3c7', text: '#92400e' },
    DEPUTY: { bg: '#dbeafe', text: '#1d4ed8' },
    HOD: { bg: '#dcfce7', text: '#16a34a' },
    SUBJECT_TEACHER: { bg: '#f3f4f6', text: '#374151' },
    CLASS_TEACHER: { bg: '#ede9fe', text: '#6d28d9' },
    SENIOR_TEACHER: { bg: '#fce7f3', text: '#be185d' },
    ADMINISTRATOR: { bg: '#e0e7ff', text: '#4338ca' },
    LOWER_PRIMARY_SENIOR_TEACHER: { bg: '#fef3c7', text: '#92400e' },
    UPPER_PRIMARY_SENIOR_TEACHER: { bg: '#fef3c7', text: '#92400e' },
  };
  const c = colors[type] || { bg: '#f3f4f6', text: '#374151' };
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: c.bg, color: c.text }}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const c = status === 'ACTIVE'
    ? { bg: '#dcfce7', text: '#16a34a' }
    : { bg: '#f3f4f6', text: '#6b7280' };
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: c.bg, color: c.text }}>{status}</span>;
}
