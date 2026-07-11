'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useIsDirector, useIsSuperAdmin } from '@/lib/auth-context';
import { useFeatureAccess } from '@/lib/useFeatureAccess';
import { premiumStaffRecordsApi } from '@/lib/api';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, ICellRendererParams, GridReadyEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

type TabType = 'overview' | 'profiles' | 'returns' | 'transfers' | 'qualifications' | 'sync' | 'analytics';

const ALL_PROFILE_FIELDS = [
  'employeeNumber', 'province', 'district', 'station', 'teacherName', 'gender', 'dateOfBirth',
  'maritalStatus', 'nrcNumber', 'tsNumber', 'aesNumber', 'substantivePosition', 'substantiveScale',
  'actingPosition', 'administration', 'actingType', 'dateOfFirstAppointment', 'dateOfPresentAppointment',
  'dateOfActingAppointment', 'confirmed', 'expectedConfirmationDate', 'allowancesEntitled',
  'employmentStatus', 'employmentType', 'contractEffectiveDate', 'contractNormalised', 'contractEnd',
  'retirementDate', 'payrollPoint', 'academicQualification', 'professionalQualification',
  'yearOfQualification', 'specialization', 'nationality', 'emailAddress', 'phoneNumber',
  'currentPosition', 'gradeLevel', 'step', 'taxId', 'pensionNumber', 'bankName', 'bankBranch',
  'bankAccount', 'socialSecurityNumber', 'nextOfKin', 'nextOfKinContact', 'nextOfKinRelationship',
];

const LABEL_MAP: Record<string, string> = {
  employeeNumber: 'Employee No', province: 'Province', district: 'District', station: 'Station',
  teacherName: 'Teacher Name', gender: 'Gender', dateOfBirth: 'Date of Birth',
  maritalStatus: 'Marital Status', nrcNumber: 'NRC Number', tsNumber: 'TS Number',
  aesNumber: 'AES Number', substantivePosition: 'Substantive Position',
  substantiveScale: 'Substantive Scale', actingPosition: 'Acting Position',
  administration: 'Administration', actingType: 'Acting Type',
  dateOfFirstAppointment: 'First Appointment Date', dateOfPresentAppointment: 'Present Appointment Date',
  dateOfActingAppointment: 'Acting Appointment Date', confirmed: 'Confirmed',
  expectedConfirmationDate: 'Expected Confirmation', allowancesEntitled: 'Allowances Entitled',
  employmentStatus: 'Status', employmentType: 'Type', contractEffectiveDate: 'Contract Effective',
  contractNormalised: 'Contract Normalised', contractEnd: 'Contract End',
  retirementDate: 'Retirement Date', payrollPoint: 'Payroll Point',
  academicQualification: 'Academic Qualification', professionalQualification: 'Professional Qualification',
  yearOfQualification: 'Qualification Year', specialization: 'Specialization',
  nationality: 'Nationality', emailAddress: 'Email', phoneNumber: 'Phone',
  currentPosition: 'Current Position', gradeLevel: 'Grade Level', step: 'Step',
  taxId: 'Tax ID', pensionNumber: 'Pension No', bankName: 'Bank Name',
  bankBranch: 'Bank Branch', bankAccount: 'Bank Account',
  socialSecurityNumber: 'SSN', nextOfKin: 'Next of Kin', nextOfKinContact: 'Next of Kin Contact',
  nextOfKinRelationship: 'Next of Kin Relationship',
};

export default function StaffRecordsPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isDirector = useIsDirector();
  const isSuperAdmin = useIsSuperAdmin();
  const { hasAccess } = useFeatureAccess();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccess = hasAccess('PREMIUM_STAFF_RETURNS_HUB');

  const fetchData = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, returnsRes, transfersRes, analyticsRes, syncStatusRes, syncHistoryRes] =
        await Promise.allSettled([
          premiumStaffRecordsApi.getProfiles(),
          premiumStaffRecordsApi.getReturns(),
          premiumStaffRecordsApi.getTransfers(),
          premiumStaffRecordsApi.getStaffAnalytics(),
          premiumStaffRecordsApi.getSyncStatus(),
          premiumStaffRecordsApi.getSyncHistory(),
        ]);

      if (profilesRes.status === 'fulfilled') setProfiles(profilesRes.value.data?.data || profilesRes.value.data || []);
      if (returnsRes.status === 'fulfilled') setReturns(returnsRes.value.data?.data || returnsRes.value.data || []);
      if (transfersRes.status === 'fulfilled') setTransfers(transfersRes.value.data?.data || transfersRes.value.data || []);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data || null);
      if (syncStatusRes.status === 'fulfilled') setSyncStatus(syncStatusRes.value.data || null);
      if (syncHistoryRes.status === 'fulfilled') setSyncHistory(syncHistoryRes.value.data?.data || syncHistoryRes.value.data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load staff records data');
    } finally {
      setLoading(false);
    }
  }, [canAccess]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await premiumStaffRecordsApi.getTemplates();
      setTemplates(res.data?.data || res.data || []);
    } catch { }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!authLoading && canAccess) {
      fetchData();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, canAccess, fetchData, router]);

  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      await premiumStaffRecordsApi.syncAll();
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Sync failed');
    }
    setSyncingAll(false);
  };

  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>Staff Returns & HR Intelligence Hub</h1>
        <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 24 }}>
          This is a premium feature. Please upgrade your subscription to access enterprise HR intelligence capabilities.
        </p>
        <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: 16, display: 'inline-block' }}>
          <p style={{ color: '#92400e', fontSize: 14 }}>Requires <strong>PREMIUM</strong> subscription tier</p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'fa-th-large' },
    { key: 'profiles', label: 'HR Profiles', icon: 'fa-id-badge' },
    { key: 'returns', label: 'Staff Returns', icon: 'fa-file-export' },
    { key: 'transfers', label: 'Transfers', icon: 'fa-exchange-alt' },
    { key: 'qualifications', label: 'Qualifications', icon: 'fa-graduation-cap' },
    { key: 'sync', label: 'Sync Status', icon: 'fa-sync' },
    { key: 'analytics', label: 'Analytics', icon: 'fa-chart-bar' },
  ];

  const authorizedRoles = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head', 'SuperAdmin'];
  const userRoles = user?.roles || [];
  const isAuthorized = userRoles.some(r => authorizedRoles.includes(r));

  if (!isAuthorized) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#dc2626' }}>Access Denied</h2>
        <p style={{ color: '#6b7280', marginTop: 8 }}>Only Director, Deputy Head, and authorized HR/Admin roles can access this module.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>Staff Returns & HR Intelligence Hub</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Premium Enterprise HR Intelligence Layer</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSyncAll} disabled={syncingAll} style={{ padding: '8px 16px', background: syncingAll ? '#d1d5db' : '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: syncingAll ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500 }}>
            <i className={`fas ${syncingAll ? 'fa-spinner fa-spin' : 'fa-sync'}`} style={{ marginRight: 6 }}></i>{syncingAll ? 'Syncing...' : 'Sync All Staff'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 16, color: '#dc2626', fontSize: 14 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e8ddd0', marginBottom: 24, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); if (tab.key === 'returns' || tab.key === 'profiles') fetchTemplates(); }} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14,
            fontWeight: activeTab === tab.key ? 600 : 400, color: activeTab === tab.key ? '#ea6645' : '#6b7280',
            borderBottom: activeTab === tab.key ? '2px solid #ea6645' : '2px solid transparent', marginBottom: -2,
            transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}>
            <i className={`fas ${tab.icon}`} style={{ marginRight: 6 }}></i>{tab.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#6b7280' }}>Loading staff records...</p>
        </div>
      )}

      {!loading && activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard icon="fa-users" label="Total HR Profiles" value={profiles.length} color="#3b82f6" />
            <StatCard icon="fa-file-export" label="Staff Returns" value={returns.length} color="#10b981" />
            <StatCard icon="fa-exchange-alt" label="Active Transfers" value={transfers.filter((t: any) => t.status === 'PENDING' || t.status === 'APPROVED').length} color="#f59e0b" />
            <StatCard icon="fa-check-circle" label="Synced Profiles" value={syncStatus?.synced || 0} color="#8b5cf6" />
          </div>
          {analytics && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ddd0', marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Workforce Summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div><p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total Staff</p><p style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>{analytics.total || 0}</p></div>
                <div><p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Active</p><p style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{analytics.statusBreakdown?.ACTIVE || 0}</p></div>
                <div><p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Avg Years in Service</p><p style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e' }}>{analytics.avgYearsInService || 0}</p></div>
                <div><p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Permanent</p><p style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{analytics.typeBreakdown?.PERMANENT || 0}</p></div>
              </div>
            </div>
          )}
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 8 }}><i className="fas fa-info-circle" style={{ marginRight: 6 }}></i>About This Module</h3>
            <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>The Staff Returns & HR Intelligence Hub is a synchronized enterprise premium extension layer. It works alongside your existing staff registration system — fetching data from it, not replacing it. Use the tabs above to manage HR profiles, generate staff returns, handle transfers, track qualifications, and access workforce analytics.</p>
          </div>
        </div>
      )}

      {!loading && activeTab === 'profiles' && (
        <ProfilesGrid profiles={profiles} onRefresh={fetchData} />
      )}

      {!loading && activeTab === 'returns' && (
        <ReturnsTabWithTemplates templates={templates} submissions={submissions} onRefresh={() => { fetchData(); fetchTemplates(); }} />
      )}

      {!loading && activeTab === 'transfers' && (
        <TransfersTab transfers={transfers} onRefresh={fetchData} profiles={profiles} />
      )}

      {!loading && activeTab === 'qualifications' && (
        <QualificationsTab profiles={profiles} onRefresh={fetchData} />
      )}

      {!loading && activeTab === 'sync' && (
        <SyncTab syncStatus={syncStatus} syncHistory={syncHistory} onSyncAll={handleSyncAll} />
      )}

      {!loading && activeTab === 'analytics' && analytics && (
        <AnalyticsTab analytics={analytics} />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ddd0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fas ${icon}`} style={{ color, fontSize: 18 }}></i>
        </div>
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{label}</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e' }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function ProfilesGrid({ profiles, onRefresh }: { profiles: any[]; onRefresh: () => void }) {
  const gridRef = useRef<AgGridReact>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [exporting, setExporting] = useState(false);

  const colDefs = useMemo<ColDef[]>(() => {
    const baseCols: ColDef[] = [
      { field: 'staffId', headerName: 'Staff ID', width: 100, pinned: 'left', filter: 'agTextColumnFilter' },
      { field: 'employeeNumber', headerName: 'Employee No', width: 110, editable: true, filter: 'agTextColumnFilter' },
      { field: 'teacherName', headerName: 'Teacher Name', width: 150, editable: true, filter: 'agTextColumnFilter' },
      { field: 'gender', headerName: 'Gender', width: 80, editable: true, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['Male', 'Female'] } },
      { field: 'employmentStatus', headerName: 'Status', width: 90, editable: true, cellRenderer: (p: ICellRendererParams) => <StatusBadge status={p.value} /> },
      { field: 'employmentType', headerName: 'Type', width: 100, editable: true },
      { field: 'gradeLevel', headerName: 'Grade', width: 70, editable: true },
      { field: 'step', headerName: 'Step', width: 60, editable: true, type: 'numericColumn' },
      { field: 'province', headerName: 'Province', width: 100, editable: true },
      { field: 'district', headerName: 'District', width: 100, editable: true },
      { field: 'station', headerName: 'Station', width: 120, editable: true },
      { field: 'substantivePosition', headerName: 'Substantive Position', width: 140, editable: true },
      { field: 'substantiveScale', headerName: 'Substantive Scale', width: 110, editable: true },
      { field: 'actingPosition', headerName: 'Acting Position', width: 130, editable: true },
      { field: 'currentPosition', headerName: 'Current Position', width: 140, editable: true },
      { field: 'academicQualification', headerName: 'Academic Qualification', width: 140, editable: true },
      { field: 'professionalQualification', headerName: 'Professional Qualification', width: 150, editable: true },
      { field: 'specialization', headerName: 'Specialization', width: 130, editable: true },
      { field: 'dateOfBirth', headerName: 'Date of Birth', width: 110, editable: true, cellEditor: 'agDateCellEditor' },
      { field: 'maritalStatus', headerName: 'Marital Status', width: 100, editable: true },
      { field: 'nrcNumber', headerName: 'NRC', width: 120, editable: true },
      { field: 'tsNumber', headerName: 'TS No', width: 100, editable: true },
      { field: 'aesNumber', headerName: 'AES No', width: 100, editable: true },
      { field: 'emailAddress', headerName: 'Email', width: 160, editable: true },
      { field: 'phoneNumber', headerName: 'Phone', width: 120, editable: true },
      { field: 'nationality', headerName: 'Nationality', width: 100, editable: true },
      { field: 'payrollPoint', headerName: 'Payroll Point', width: 100, editable: true },
      { field: 'taxId', headerName: 'Tax ID', width: 100, editable: true },
      { field: 'pensionNumber', headerName: 'Pension No', width: 100, editable: true },
      { field: 'bankName', headerName: 'Bank Name', width: 120, editable: true },
      { field: 'bankAccount', headerName: 'Bank Account', width: 120, editable: true },
      { field: 'socialSecurityNumber', headerName: 'SSN', width: 100, editable: true },
      { field: 'contractEffectiveDate', headerName: 'Contract Effective', width: 120, editable: true },
      { field: 'contractEnd', headerName: 'Contract End', width: 110, editable: true },
      { field: 'retirementDate', headerName: 'Retirement', width: 100, editable: true },
      { field: 'syncStatus', headerName: 'Sync', width: 80, cellRenderer: (p: ICellRendererParams) => <StatusBadge status={p.value} /> },
    ];
    return baseCols;
  }, []);

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: true,
    minWidth: 60,
  }), []);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent) => {
    try {
      await premiumStaffRecordsApi.updateProfile(event.data.id, { [event.colDef.field!]: event.newValue });
    } catch {
      event.node.setDataValue(event.colDef.field!, event.oldValue);
    }
  }, []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  const onQuickFilterChanged = useCallback(() => {
    gridRef.current?.api.setGridOption('quickFilterText', searchText);
  }, [searchText]);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await premiumStaffRecordsApi.exportProfilesExcel();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'staff_profiles.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { }
    setExporting(false);
  };

  if (profiles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0' }}>
        <p style={{ color: '#6b7280', marginBottom: 12 }}>No HR profiles yet. Sync your staff to create profiles.</p>
        <button onClick={onRefresh} style={{ padding: '8px 16px', background: '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          <i className="fas fa-sync" style={{ marginRight: 6 }}></i>Refresh
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>HR Profiles ({profiles.length})</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search profiles..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onInput={onQuickFilterChanged}
            style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 200 }}
          />
          <button onClick={handleExportExcel} disabled={exporting} style={{ padding: '6px 14px', background: exporting ? '#d1d5db' : '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: exporting ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-file-excel'}`} style={{ marginRight: 6 }}></i>{exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
        <div className="ag-theme-quartz" style={{ height: 'calc(100vh - 280px)', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={profiles}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            onCellValueChanged={onCellValueChanged}
            onGridReady={onGridReady}
            animateRows={true}
            enableCellTextSelection={true}
            ensureDomOrder={true}
            rowSelection="single"
            pagination={true}
            paginationPageSize={100}
            paginationPageSizeSelector={[50, 100, 200, 500]}
            quickFilterText={searchText}
          />
        </div>
      </div>
    </div>
  );
}

function ReturnsTabWithTemplates({ templates, submissions, onRefresh }: { templates: any[]; submissions: any[]; onRefresh: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState<'templates' | 'submissions'>('templates');
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [templateColumns, setTemplateColumns] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [btnLoading, setBtnLoading] = useState<Record<string, boolean>>({});

  const withBtnLoading = async (key: string, fn: () => Promise<void>) => {
    setBtnLoading(prev => ({ ...prev, [key]: true }));
    try { await fn(); } finally { setBtnLoading(prev => ({ ...prev, [key]: false })); }
  };

  const fetchColumns = useCallback(async (templateId: string) => {
    try {
      const res = await premiumStaffRecordsApi.getTemplateById(templateId);
      const t = res.data?.data || res.data;
      if (t?.columns) setTemplateColumns(t.columns);
      else setTemplateColumns([]);
      setEditTemplate(t);
      setTemplateName(t?.name || '');
    } catch {
      setTemplateColumns([]);
    }
  }, []);

  const handleCreateTemplate = () => {
    withBtnLoading('createTemplate', async () => {
      await premiumStaffRecordsApi.createTemplate({ name: 'New Return Template', returnType: 'MONTHLY', category: 'DISTRICT' });
      onRefresh();
    });
  };

  const handleSaveTemplate = () => {
    if (!editTemplate?.id) return;
    withBtnLoading('saveTemplate', async () => {
      await premiumStaffRecordsApi.updateTemplate(editTemplate.id, { name: templateName });
      onRefresh();
    });
  };

  const handleAddColumn = () => {
    if (!selectedTemplateId) return;
    withBtnLoading('addColumn', async () => {
      await premiumStaffRecordsApi.addColumn(selectedTemplateId, {
        columnName: `field_${Date.now()}`,
        columnLabel: 'New Field',
        columnOrder: templateColumns.length + 1,
        dataType: 'string',
        isRequired: false,
        isEditable: true,
        isVisible: true,
      });
      fetchColumns(selectedTemplateId);
    });
  };

  const handleDeleteColumn = (columnId: string) => {
    withBtnLoading(`deleteCol_${columnId}`, async () => {
      await premiumStaffRecordsApi.deleteColumn(columnId);
      if (selectedTemplateId) fetchColumns(selectedTemplateId);
    });
  };

  const handleColumnToggle = (column: any) => {
    withBtnLoading(`toggle_${column.id}`, async () => {
      await premiumStaffRecordsApi.updateColumn(column.id, { isVisible: !column.isVisible });
      if (selectedTemplateId) fetchColumns(selectedTemplateId);
    });
  };

  const handleColumnRename = async (columnId: string, newName: string) => {
    try {
      await premiumStaffRecordsApi.updateColumn(columnId, { columnLabel: newName });
      if (selectedTemplateId) fetchColumns(selectedTemplateId);
    } catch { }
  };

  const handleExportTemplate = (templateId: string) => {
    withBtnLoading(`export_${templateId}`, async () => {
      const res = await premiumStaffRecordsApi.exportTemplateExcel(templateId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${templateId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const handleDuplicateTemplate = (templateId: string) => {
    withBtnLoading(`dup_${templateId}`, async () => {
      await premiumStaffRecordsApi.duplicateTemplate(templateId);
      onRefresh();
    });
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (!confirm('Delete this template and all its columns?')) return;
    withBtnLoading(`del_${templateId}`, async () => {
      await premiumStaffRecordsApi.deleteTemplate(templateId);
      if (selectedTemplateId === templateId) { setSelectedTemplateId(null); setTemplateColumns([]); setEditTemplate(null); }
      onRefresh();
    });
  };

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
      fetchColumns(templates[0].id);
    }
  }, [templates, selectedTemplateId, fetchColumns]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e8ddd0', marginBottom: 16 }}>
        <button onClick={() => setActiveSubTab('templates')} style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: activeSubTab === 'templates' ? 600 : 400, color: activeSubTab === 'templates' ? '#ea6645' : '#6b7280', borderBottom: activeSubTab === 'templates' ? '2px solid #ea6645' : '2px solid transparent', marginBottom: -2 }}>Template Configurator</button>
        <button onClick={() => setActiveSubTab('submissions')} style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: activeSubTab === 'submissions' ? 600 : 400, color: activeSubTab === 'submissions' ? '#ea6645' : '#6b7280', borderBottom: activeSubTab === 'submissions' ? '2px solid #ea6645' : '2px solid transparent', marginBottom: -2 }}>Submissions</button>
      </div>

      {activeSubTab === 'templates' && (
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
              <div style={{ padding: 12, borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Templates</span>
                <button onClick={handleCreateTemplate} disabled={btnLoading['createTemplate']} style={{ padding: '4px 10px', background: btnLoading['createTemplate'] ? '#d1d5db' : '#ea6645', color: '#fff', border: 'none', borderRadius: 4, cursor: btnLoading['createTemplate'] ? 'not-allowed' : 'pointer', fontSize: 12 }}><i className={`fas ${btnLoading['createTemplate'] ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i></button>
              </div>
              {templates.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>No templates yet.</div>
              ) : (
                templates.map((t: any) => (
                  <div key={t.id} onClick={() => { setSelectedTemplateId(t.id); fetchColumns(t.id); }} style={{
                    padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f3eee8',
                    background: selectedTemplateId === t.id ? '#fef3c7' : 'transparent',
                    fontWeight: selectedTemplateId === t.id ? 600 : 400, fontSize: 13
                  }}>
                    <div>{t.name || 'Unnamed Template'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{t.returnType || 'MONTHLY'} · {t.columns?.length || 0} cols</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {editTemplate ? (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 16 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                  <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name" style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
                  <button onClick={handleSaveTemplate} disabled={btnLoading['saveTemplate']} style={{ padding: '6px 14px', background: btnLoading['saveTemplate'] ? '#d1d5db' : '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: btnLoading['saveTemplate'] ? 'not-allowed' : 'pointer', fontSize: 13 }}>{btnLoading['saveTemplate'] ? 'Saving...' : 'Save'}</button>
                  <button onClick={() => handleDuplicateTemplate(editTemplate.id)} disabled={btnLoading[`dup_${editTemplate.id}`]} style={{ padding: '6px 14px', background: btnLoading[`dup_${editTemplate.id}`] ? '#d1d5db' : '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: btnLoading[`dup_${editTemplate.id}`] ? 'not-allowed' : 'pointer', fontSize: 13 }}>{btnLoading[`dup_${editTemplate.id}`] ? 'Duplicating...' : 'Duplicate'}</button>
                  <button onClick={() => handleDeleteTemplate(editTemplate.id)} disabled={btnLoading[`del_${editTemplate.id}`]} style={{ padding: '6px 14px', background: btnLoading[`del_${editTemplate.id}`] ? '#d1d5db' : '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: btnLoading[`del_${editTemplate.id}`] ? 'not-allowed' : 'pointer', fontSize: 13 }}>{btnLoading[`del_${editTemplate.id}`] ? 'Deleting...' : 'Delete'}</button>
                  <button onClick={() => handleExportTemplate(editTemplate.id)} disabled={btnLoading[`export_${editTemplate.id}`]} style={{ padding: '6px 14px', background: btnLoading[`export_${editTemplate.id}`] ? '#d1d5db' : '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: btnLoading[`export_${editTemplate.id}`] ? 'not-allowed' : 'pointer', fontSize: 13 }}><i className={`fas ${btnLoading[`export_${editTemplate.id}`] ? 'fa-spinner fa-spin' : 'fa-file-excel'}`}></i> {btnLoading[`export_${editTemplate.id}`] ? 'Exporting...' : 'Excel'}</button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Columns ({templateColumns.length})</span>
                  <button onClick={handleAddColumn} disabled={btnLoading['addColumn']} style={{ padding: '4px 10px', background: btnLoading['addColumn'] ? '#d1d5db' : '#ea6645', color: '#fff', border: 'none', borderRadius: 4, cursor: btnLoading['addColumn'] ? 'not-allowed' : 'pointer', fontSize: 12 }}><i className={`fas ${btnLoading['addColumn'] ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i> {btnLoading['addColumn'] ? 'Adding...' : 'Add Column'}</button>
                </div>
                {templateColumns.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#6b7280', padding: 20, fontSize: 13 }}>No columns. Add a column to start building your return template.</div>
                ) : (
                  <div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f9f5f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', fontWeight: 600, width: 40 }}>#</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Column Name</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Header</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Type</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Required</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Editable</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600 }}>Active</th>
                          <th style={{ padding: '8px 10px', fontWeight: 600, width: 80 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {templateColumns.sort((a: any, b: any) => (a.columnOrder || 0) - (b.columnOrder || 0)).map((col: any, idx: number) => (
                          <tr key={col.id} style={{ borderTop: '1px solid #f3eee8' }}>
                            <td style={{ padding: '6px 10px', color: '#6b7280' }}>{idx + 1}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 12 }}>{col.columnName}</td>
                            <td style={{ padding: '6px 10px' }}>
                              <input
                                defaultValue={col.columnLabel}
                                onBlur={e => handleColumnRename(col.id, e.target.value)}
                                style={{ width: '100%', border: '1px solid transparent', padding: '2px 4px', borderRadius: 4, fontSize: 13, background: 'transparent' }}
                                onFocus={e => (e.target.style.borderColor = '#d1d5db')}
                              />
                            </td>
                            <td style={{ padding: '6px 10px' }}>{col.dataType}</td>
                            <td style={{ padding: '6px 10px' }}>{col.isRequired ? '\u2713' : '\u2717'}</td>
                            <td style={{ padding: '6px 10px' }}>{col.isEditable !== false ? '\u2713' : '\u2717'}</td>
                            <td style={{ padding: '6px 10px' }}>
                              <input type="checkbox" checked={col.isVisible !== false} onChange={() => handleColumnToggle(col)} disabled={!!btnLoading[`toggle_${col.id}`]} />
                            </td>
                            <td style={{ padding: '6px 10px' }}>
                              <button onClick={() => handleDeleteColumn(col.id)} disabled={btnLoading[`deleteCol_${col.id}`]} style={{ padding: '2px 6px', background: btnLoading[`deleteCol_${col.id}`] ? '#e5e7eb' : '#fecaca', color: '#dc2626', border: 'none', borderRadius: 4, cursor: btnLoading[`deleteCol_${col.id}`] ? 'not-allowed' : 'pointer', fontSize: 11 }}>{btnLoading[`deleteCol_${col.id}`] ? '...' : 'Delete'}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Select a template from the left to configure its columns.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'submissions' && (
        <SubmissionsGrid templates={templates} />
      )}
    </div>
  );
}

function SubmissionsGrid({ templates }: { templates: any[] }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [subData, setSubData] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [submissionPeriod, setSubmissionPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);
  const [subLoading, setSubLoading] = useState<Record<string, boolean>>({});

  const withSubLoading = async (key: string, fn: () => Promise<void>) => {
    setSubLoading(prev => ({ ...prev, [key]: true }));
    try { await fn(); } finally { setSubLoading(prev => ({ ...prev, [key]: false })); }
  };

  const fetchSubmissions = useCallback(async (templateId?: string) => {
    setLoading(true);
    try {
      const res = await premiumStaffRecordsApi.getSubmissions(templateId || undefined);
      setSubmissions(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
  }, []);

  const handleCreateSubmission = () => {
    if (!selectedTemplate) return;
    withSubLoading('create', async () => {
      await premiumStaffRecordsApi.createSubmission({
        templateId: selectedTemplate,
        period: submissionPeriod,
        academicYear: new Date().getFullYear().toString(),
        term: 'Term 1',
      });
      fetchSubmissions(selectedTemplate);
    });
  };

  const handleSubmit = (id: string) => {
    withSubLoading(`submit_${id}`, async () => {
      await premiumStaffRecordsApi.submitSubmission(id);
      fetchSubmissions(selectedTemplate);
    });
  };

  const handleApprove = (id: string) => {
    withSubLoading(`approve_${id}`, async () => {
      await premiumStaffRecordsApi.approveSubmission(id);
      fetchSubmissions(selectedTemplate);
    });
  };

  const handleExport = (id: string) => {
    withSubLoading(`export_${id}`, async () => {
      const res = await premiumStaffRecordsApi.exportSubmissionExcel(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `submission_${id}.xlsx`;
      a.href = url;
      a.download = `submission_${id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <select value={selectedTemplate} onChange={e => { setSelectedTemplate(e.target.value); fetchSubmissions(e.target.value); }} style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
          <option value="">All Templates</option>
          {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input value={submissionPeriod} onChange={e => setSubmissionPeriod(e.target.value)} placeholder="Period (YYYY-MM)" style={{ width: 130, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }} />
        <button onClick={handleCreateSubmission} disabled={!selectedTemplate || !!subLoading['create']} style={{ padding: '6px 14px', background: selectedTemplate && !subLoading['create'] ? '#ea6645' : '#d1d5db', color: '#fff', border: 'none', borderRadius: 6, cursor: selectedTemplate && !subLoading['create'] ? 'pointer' : 'not-allowed', fontSize: 13 }}>
          <i className={`fas ${subLoading['create'] ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i> {subLoading['create'] ? 'Creating...' : 'New Submission'}
        </button>
      </div>

      {submissions.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 40, textAlign: 'center', color: '#6b7280' }}>
          {loading ? 'Loading...' : 'No submissions yet. Select a template and create a new submission.'}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9f5f0', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Template</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Period</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Records</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Created</th>
                <th style={{ padding: '8px 12px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s: any) => (
                <tr key={s.id} style={{ borderTop: '1px solid #f3eee8' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{s.template?.name || s.templateId}</td>
                  <td style={{ padding: '8px 12px' }}>{s.period || '-'}</td>
                  <td style={{ padding: '8px 12px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '8px 12px' }}>{s.data?.length || 0}</td>
                  <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 12 }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {s.status === 'DRAFT' && <button onClick={() => handleSubmit(s.id)} disabled={!!subLoading[`submit_${s.id}`]} style={{ padding: '3px 8px', background: subLoading[`submit_${s.id}`] ? '#93c5fd' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: subLoading[`submit_${s.id}`] ? 'not-allowed' : 'pointer', fontSize: 11 }}>{subLoading[`submit_${s.id}`] ? '...' : 'Submit'}</button>}
                      {s.status === 'SUBMITTED' && <button onClick={() => handleApprove(s.id)} disabled={!!subLoading[`approve_${s.id}`]} style={{ padding: '3px 8px', background: subLoading[`approve_${s.id}`] ? '#6ee7b7' : '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: subLoading[`approve_${s.id}`] ? 'not-allowed' : 'pointer', fontSize: 11 }}>{subLoading[`approve_${s.id}`] ? '...' : 'Approve'}</button>}
                      <button onClick={() => handleExport(s.id)} disabled={!!subLoading[`export_${s.id}`]} style={{ padding: '3px 8px', background: subLoading[`export_${s.id}`] ? '#9ca3af' : '#6b7280', color: '#fff', border: 'none', borderRadius: 4, cursor: subLoading[`export_${s.id}`] ? 'not-allowed' : 'pointer', fontSize: 11 }}>{subLoading[`export_${s.id}`] ? '...' : 'Excel'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransfersTab({ transfers, onRefresh, profiles }: { transfers: any[]; onRefresh: () => void; profiles: any[] }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e8ddd0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Staff Transfers ({transfers.length})</h3>
      </div>
      {transfers.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No staff transfers recorded.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9f5f0', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>From</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>To</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t: any) => (
                <tr key={t.id} style={{ borderTop: '1px solid #f3eee8' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500 }}>{t.transferType}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{t.fromDistrict || t.fromSchoolId?.slice(0, 8)}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280', fontSize: 12 }}>{t.toDistrict || t.toSchoolId?.slice(0, 8)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12 }}>{new Date(t.transferDate).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 14px' }}><StatusBadge status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QualificationsTab({ profiles, onRefresh }: { profiles: any[]; onRefresh: () => void }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', padding: 20 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Staff Qualifications</h3>
      <p style={{ color: '#6b7280', fontSize: 14 }}>Select an HR profile to view and manage qualifications.</p>
      {profiles.length === 0 && <p style={{ color: '#9ca3af', marginTop: 12, fontSize: 13 }}>No profiles available. Sync staff first.</p>}
    </div>
  );
}

function SyncTab({ syncStatus, syncHistory, onSyncAll }: { syncStatus: any; syncHistory: any[]; onSyncAll: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const handleSync = () => {
    setSyncing(true);
    onSyncAll();
    setTimeout(() => setSyncing(false), 2000);
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e8ddd0' }}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total</p>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{syncStatus?.total || 0}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e8ddd0' }}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Synced</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{syncStatus?.synced || 0}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e8ddd0' }}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Pending</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#92400e' }}>{syncStatus?.pending || 0}</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e8ddd0' }}>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Conflict</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{syncStatus?.conflict || 0}</p>
        </div>
      </div>
      <button onClick={handleSync} disabled={syncing} style={{ padding: '8px 16px', background: syncing ? '#d1d5db' : '#ea6645', color: '#fff', border: 'none', borderRadius: 6, cursor: syncing ? 'not-allowed' : 'pointer', marginBottom: 20, fontSize: 14 }}>
        <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync'}`} style={{ marginRight: 6 }}></i>{syncing ? 'Syncing...' : 'Run Full Sync'}
      </button>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8ddd0', overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #e8ddd0', fontWeight: 600, fontSize: 14 }}>Sync History</div>
        {syncHistory.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>No sync history yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f9f5f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Source</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600 }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {syncHistory.map((h: any) => (
                  <tr key={h.id} style={{ borderTop: '1px solid #f3eee8' }}>
                    <td style={{ padding: '8px 12px' }}>{h.syncType}</td>
                    <td style={{ padding: '8px 12px' }}>{h.source}</td>
                    <td style={{ padding: '8px 12px' }}><StatusBadge status={h.status} /></td>
                    <td style={{ padding: '8px 12px', color: '#6b7280' }}>{new Date(h.syncedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab({ analytics }: { analytics: any }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}><i className="fas fa-circle" style={{ color: '#3b82f6', marginRight: 6, fontSize: 10 }}></i>Employment Status</h3>
          {analytics.statusBreakdown && Object.entries(analytics.statusBreakdown).map(([status, count]: any) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3eee8', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{status}</span><span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}><i className="fas fa-circle" style={{ color: '#10b981', marginRight: 6, fontSize: 10 }}></i>Employment Type</h3>
          {analytics.typeBreakdown && Object.entries(analytics.typeBreakdown).map(([type, count]: any) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3eee8', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{type}</span><span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ddd0' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}><i className="fas fa-circle" style={{ color: '#f59e0b', marginRight: 6, fontSize: 10 }}></i>Grade Levels</h3>
          {analytics.gradeBreakdown && Object.entries(analytics.gradeBreakdown).map(([grade, count]: any) => (
            <div key={grade} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3eee8', fontSize: 13 }}>
              <span style={{ color: '#6b7280' }}>{grade}</span><span style={{ fontWeight: 600 }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e8ddd0', marginTop: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}><i className="fas fa-circle" style={{ color: '#8b5cf6', marginRight: 6, fontSize: 10 }}></i>Qualification Levels</h3>
        {analytics.qualificationLevels && Object.entries(analytics.qualificationLevels).map(([level, count]: any) => (
          <div key={level} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3eee8', fontSize: 13 }}>
            <span style={{ color: '#6b7280' }}>{level}</span><span style={{ fontWeight: 600 }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: '#f3f4f6', text: '#374151' },
    PENDING: { bg: '#fef3c7', text: '#92400e' },
    SUBMITTED: { bg: '#dbeafe', text: '#1d4ed8' },
    APPROVED: { bg: '#dcfce7', text: '#16a34a' },
    COMPLETED: { bg: '#dcfce7', text: '#16a34a' },
    REJECTED: { bg: '#fecaca', text: '#dc2626' },
    CANCELLED: { bg: '#f3f4f6', text: '#6b7280' },
    SUCCESS: { bg: '#dcfce7', text: '#16a34a' },
    FAILED: { bg: '#fecaca', text: '#dc2626' },
    CONFLICT: { bg: '#fef3c7', text: '#92400e' },
    SYNCED: { bg: '#dcfce7', text: '#16a34a' },
    ACTIVE: { bg: '#dcfce7', text: '#16a34a' },
  };
  const c = colors[status] || { bg: '#f3f4f6', text: '#374151' };
  return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: c.bg, color: c.text }}>{status}</span>;
}
