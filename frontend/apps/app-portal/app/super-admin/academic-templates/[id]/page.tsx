'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';

interface Component {
  id: string;
  type: string;
  label: string;
  content: any;
  styles: any;
  position: any;
  size: any;
  sortOrder: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  templateType: string;
  primaryColor: string;
  secondaryColor: string;
  pageSize: string;
  orientation: string;
  fontFamily: string;
  fontSize: number;
  category: { name: string; slug: string };
  components: Component[];
  certificate?: any;
}

export default function TemplateDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'components' | 'settings' | 'certificate'>('preview');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && params?.id) loadTemplate();
  }, [isAuthenticated, params?.id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/super-admin/academic-templates/${params.id}`);
      setTemplate(res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to load template:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      await api.post(`/super-admin/academic-templates/${params.id}/duplicate`);
      alert('Template duplicated successfully!');
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this template permanently?')) return;
    try {
      await api.delete(`/super-admin/academic-templates/${params.id}`);
      router.push('/super-admin/academic-templates');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleApplyToSchool = async () => {
    const schoolId = prompt('Enter School ID to apply this template:');
    if (!schoolId) return;
    try {
      const tplRes = await api.get(`/super-admin/academic-templates/${params.id}`);
      const tpl = tplRes.data?.data || tplRes.data;
      const copyData = {
        name: tpl.name,
        templateType: tpl.templateType,
        pageSize: tpl.pageSize,
        orientation: tpl.orientation,
        primaryColor: tpl.primaryColor,
        secondaryColor: tpl.secondaryColor,
        fontFamily: tpl.fontFamily,
        fontSize: tpl.fontSize,
        includeLogo: true,
        includeSignature: true,
        remarksEnabled: true,
      };
      await api.post(`/template-builder`, copyData, {
        headers: { 'x-school-id': schoolId },
      });
      alert('Template applied to school successfully!');
    } catch (err) {
      console.error('Apply failed:', err);
    }
  };

  const getComponentIcon = (type: string) => {
    const icons: Record<string, string> = {
      HEADER: 'align-left', SCHOOL_LOGO: 'image', SCHOOL_NAME: 'building',
      STUDENT_INFO: 'user', STUDENT_PHOTO: 'camera', ATTENDANCE_TABLE: 'clipboard-check',
      SUBJECT_TABLE: 'table', RESULTS_TABLE: 'chart-bar', GRADE_TABLE: 'award',
      RANKING_TABLE: 'trophy', PERFORMANCE_CHART: 'chart-line', ANALYTICS_SUMMARY: 'calculator',
      TEACHER_REMARKS: 'comment', HEAD_TEACHER_REMARKS: 'comment-dots',
      PROMOTION_STATUS: 'arrow-up', SIGNATURE: 'pen', STAMP: 'stamp',
      QR_CODE: 'qrcode', FOOTER: 'align-right', DIVIDER: 'minus',
      WATERMARK: 'tint', BADGE: 'medal', AWARD_TEXT: 'scroll',
      RECOMMENDATIONS: 'lightbulb', COMPETENCY_HEATMAP: 'th',
      BORDER: 'border-all', CUSTOM_TEXT: 'font',
    };
    return icons[type] || 'puzzle-piece';
  };

  if (isLoading || loading || !template) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .tab-link { transition: all 0.2s ease; cursor: pointer; }
        .tab-link:hover { background: #f5efe8; }
        .comp-item { transition: all 0.2s ease; }
        .comp-item:hover { background: #f5efe8; transform: translateX(4px); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <button onClick={() => router.push('/super-admin/academic-templates')} style={{ padding: '6px 12px', background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa fa-arrow-left"></i> Back
            </button>
            <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', background: '#f3f4f6', color: '#374151', textTransform: 'capitalize' }}>
              {template.templateType?.replace(/_/g, ' ').toLowerCase()}
            </span>
            <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', background: '#eff6ff', color: '#2563eb' }}>
              {template.category?.name || 'Uncategorized'}
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>{template.name}</h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{template.description || 'No description'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={handleDuplicate} style={{ padding: '10px 18px', background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa fa-copy"></i> Duplicate
          </button>
          <button onClick={handleApplyToSchool} style={{ padding: '10px 18px', background: gradGreen, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa fa-share"></i> Apply to School
          </button>
          <button onClick={handleDelete} style={{ padding: '10px 18px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa fa-trash"></i> Delete
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Page Size', value: template.pageSize || 'A4', icon: 'expand' },
          { label: 'Orientation', value: template.orientation || 'portrait', icon: template.orientation === 'landscape' ? 'arrows-alt-h' : 'arrows-alt-v' },
          { label: 'Font', value: `${template.fontFamily || 'Arial'} ${template.fontSize || 11}px`, icon: 'font' },
          { label: 'Components', value: `${template.components?.length || 0}`, icon: 'puzzle-piece' },
        ].map(info => (
          <div key={info.label} style={{ background: '#fefcf9', borderRadius: '12px', padding: '16px', border: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <i className={`fa fa-${info.icon}`} style={{ fontSize: '14px', color: '#9ca3af' }}></i>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{info.label}</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>{info.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#fefcf9', borderRadius: '12px', padding: '4px', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
        {(['preview', 'components', 'settings', 'certificate'] as const).map(tab => (
          <button
            key={tab}
            className="tab-link"
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '12px 20px', border: 'none', borderRadius: '8px',
              background: activeTab === tab ? gradOrange : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              fontWeight: activeTab === tab ? 600 : 500,
              fontSize: '14px', cursor: 'pointer', textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {tab === 'components' && <i className="fa fa-puzzle-piece" style={{ marginRight: '6px' }}></i>}
            {tab === 'preview' && <i className="fa fa-eye" style={{ marginRight: '6px' }}></i>}
            {tab === 'settings' && <i className="fa fa-cog" style={{ marginRight: '6px' }}></i>}
            {tab === 'certificate' && <i className="fa fa-certificate" style={{ marginRight: '6px' }}></i>}
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'preview' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: template.orientation === 'landscape' ? '700px' : '500px',
            height: template.orientation === 'landscape' ? '500px' : '700px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              padding: '20px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ textAlign: 'center', padding: '10px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '4px', fontSize: '14px', fontWeight: 600 }}>
                {template.name}
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '8px', background: '#f9fafb', borderRadius: '4px' }}>
                <div style={{ width: '40px', height: '40px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa fa-image" style={{ color: '#9ca3af' }}></i>
                </div>
                <div>
                  <div style={{ width: '120px', height: '10px', background: '#e5e7eb', borderRadius: '2px', marginBottom: '4px' }}></div>
                  <div style={{ width: '80px', height: '8px', background: '#e5e7eb', borderRadius: '2px' }}></div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px', background: '#f9fafb', borderRadius: '4px' }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ height: '16px', background: '#e5e7eb', borderRadius: '2px', width: `${60 + i * 10}%` }}></div>
                ))}
              </div>
              <div style={{ flex: 1, background: '#f9fafb', borderRadius: '4px', padding: '8px' }}>
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[1,2,3,4,5,6,7].map(i => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ width: '60px', height: '14px', background: template.primaryColor || '#1a365d', borderRadius: '2px', opacity: 0.3 }}></div>
                      <div style={{ flex: 1, height: '14px', background: '#e5e7eb', borderRadius: '2px' }}></div>
                      <div style={{ width: '30px', height: '14px', background: '#e5e7eb', borderRadius: '2px' }}></div>
                      <div style={{ width: '30px', height: '14px', background: '#e5e7eb', borderRadius: '2px' }}></div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px', fontSize: '10px', color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
                Template Preview - {template.pageSize || 'A4'} {template.orientation || 'portrait'}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '16px' }}>This is a layout preview. Full rendering will include real data.</p>
        </div>
      )}

      {activeTab === 'components' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-puzzle-piece" style={{ color: '#ea6645' }}></i>
              Report Components ({template.components?.length || 0})
            </h3>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {(template.components || []).sort((a, b) => a.sortOrder - b.sortOrder).map((comp, idx) => (
                <div key={comp.id} className="comp-item" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', background: '#f9fafb', borderRadius: '8px',
                  border: '1px solid #f3f4f6',
                }}>
                  <div style={{
                    width: '32px', height: '32px',
                    background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                    borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <i className={`fa fa-${getComponentIcon(comp.type)}`} style={{ fontSize: '14px', color: '#7c3aed' }}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{comp.label || comp.type}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {comp.type} · Order {comp.sortOrder}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {comp.position?.x || 0}x{comp.position?.y || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-cog" style={{ color: '#ea6645' }}></i>
            Template Settings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Template Type', value: template.templateType },
              { label: 'Page Size', value: template.pageSize },
              { label: 'Orientation', value: template.orientation },
              { label: 'Font Family', value: template.fontFamily },
              { label: 'Font Size', value: `${template.fontSize}px` },
              { label: 'Primary Color', value: template.primaryColor, color: true },
              { label: 'Secondary Color', value: template.secondaryColor, color: true },
              { label: 'Category', value: template.category?.name || 'N/A' },
            ].map(setting => (
              <div key={setting.label} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{setting.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>
                  {'color' in setting && setting.color ? (
                    <>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: (setting as any).value, border: '1px solid #e5e7eb' }}></div>
                      {setting.value}
                    </>
                  ) : setting.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'certificate' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
          {template.certificate ? (
            <>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-certificate" style={{ color: '#ea6645' }}></i>
                Certificate Settings
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                {[
                  { label: 'Certificate Type', value: template.certificate.certificateType },
                  { label: 'Border Style', value: template.certificate.borderStyle },
                  { label: 'Border Color', value: template.certificate.borderColor, color: true },
                  { label: 'QR Code', value: template.certificate.showQrCode ? 'Enabled' : 'Disabled' },
                  { label: 'Auto Numbering', value: template.certificate.autoNumbering ? 'Enabled' : 'Disabled' },
                  { label: 'Badge Style', value: template.certificate.badgeStyle },
                  { label: 'Signature 1', value: template.certificate.signature1Label },
                  { label: 'Signature 2', value: template.certificate.signature2Label || 'N/A' },
                ].map(setting => (
                  <div key={setting.label} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{setting.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>
                      {'color' in setting && setting.color ? (
                        <>
                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: setting.value as string, border: '1px solid #e5e7eb' }}></div>
                          {setting.value}
                        </>
                      ) : String(setting.value)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fa fa-certificate" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>This template does not have certificate settings</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
