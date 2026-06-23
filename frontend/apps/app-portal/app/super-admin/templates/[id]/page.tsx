'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';

interface Component {
  id: string;
  type: string;
  label: string;
  content: any;
  styles: any;
  position: any;
  size: any;
  sortOrder: number;
  children?: Component[];
}

interface Template {
  id: string;
  name: string;
  description?: string;
  templateType: string;
  primaryColor?: string;
  secondaryColor?: string;
  pageSize?: string;
  orientation?: string;
  fontFamily?: string;
  fontSize?: number;
  version?: number;
  status?: string;
  isDefault?: boolean;
  category?: { id: string; name: string; slug: string };
  components?: Component[];
  certificate?: any;
  createdAt?: string;
  updatedAt?: string;
}

function getComponentIcon(type: string): string {
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
}

export default function TemplateDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'components' | 'settings'>('preview');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && params?.id) loadTemplate();
  }, [isAuthenticated, params?.id]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const res = await templateBuilderApi.getTemplate(params.id as string);
      setTemplate(res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to load template:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!template) return;
    try {
      await templateBuilderApi.publishTemplate(template.id);
      loadTemplate();
    } catch (err) {
      console.error('Publish failed:', err);
    }
  };

  const handleArchive = async () => {
    if (!template) return;
    try {
      await templateBuilderApi.archiveTemplate(template.id);
      loadTemplate();
    } catch (err) {
      console.error('Archive failed:', err);
    }
  };

  const handleDuplicate = async () => {
    if (!template) return;
    try {
      const res = await templateBuilderApi.duplicateTemplate(template.id);
      const dup = res.data?.data || res.data;
      router.push(`/super-admin/templates/${dup.id}`);
    } catch (err) {
      console.error('Duplicate failed:', err);
    }
  };

  const handleDelete = async () => {
    if (!template || !window.confirm('Delete this template permanently?')) return;
    try {
      await templateBuilderApi.deleteTemplate(template.id);
      router.push('/super-admin/templates');
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!template) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '64px', height: '64px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa fa-exclamation-triangle" style={{ fontSize: '28px', color: '#dc2626' }}></i>
        </div>
        <p style={{ fontSize: '14px', color: '#6b7280' }}>Template not found.</p>
        <button onClick={() => router.push('/super-admin/templates')} style={{ padding: '10px 20px', background: gradBlue, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          <i className="fa fa-arrow-left" style={{ marginRight: '6px' }}></i>Back to Templates
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .tab-link { transition: all 0.2s ease; cursor: pointer; }
        .tab-link:hover { background: #f5efe8; }
        .comp-item { transition: all 0.2s ease; }
        .comp-item:hover { background: #f5efe8; transform: translateX(4px); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <button onClick={() => router.push('/super-admin/templates')} style={{ padding: '6px 12px', background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa fa-arrow-left"></i> Back
            </button>
            <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', background: '#f3f4f6', color: '#374151', textTransform: 'capitalize' }}>
              {template.templateType?.replace(/_/g, ' ').toLowerCase()}
            </span>
            {template.status && (
              <span style={{
                padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '6px',
                background: template.status === 'PUBLISHED' ? '#d1fae5' : template.status === 'DRAFT' ? '#fef3c7' : '#fee2e2',
                color: template.status === 'PUBLISHED' ? '#065f46' : template.status === 'DRAFT' ? '#92400e' : '#991b1b',
                textTransform: 'capitalize',
              }}>
                {template.status.toLowerCase()}
              </span>
            )}
            {template.category && (
              <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', background: '#eff6ff', color: '#2563eb' }}>
                {template.category.name}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px' }}>{template.name}</h1>
          {template.description && <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>{template.description}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleDuplicate} style={{ padding: '10px 18px', background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa fa-copy"></i> Duplicate
          </button>
          {template.status !== 'PUBLISHED' && (
            <button onClick={handlePublish} style={{ padding: '10px 18px', background: gradGreen, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa fa-check-circle"></i> Publish
            </button>
          )}
          {template.status === 'PUBLISHED' && (
            <button onClick={handleArchive} style={{ padding: '10px 18px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa fa-archive"></i> Archive
            </button>
          )}
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
      <div style={{ display: 'flex', gap: '4px', background: '#fefcf9', borderRadius: '12px', padding: '4px', border: '1px solid #f3f4f6' }}>
        {(['preview', 'components', 'settings'] as const).map(tab => (
          <button key={tab} className="tab-link" onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '12px 20px', border: 'none', borderRadius: '8px',
            background: activeTab === tab ? gradOrange : 'transparent',
            color: activeTab === tab ? 'white' : '#6b7280',
            fontWeight: activeTab === tab ? 600 : 500,
            fontSize: '14px', cursor: 'pointer', textTransform: 'capitalize',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}>
            <i className={`fa ${tab === 'preview' ? 'fa-eye' : tab === 'components' ? 'fa-puzzle-piece' : 'fa-cog'}`}></i>
            {tab} {tab === 'components' && <span style={{ background: activeTab === tab ? 'rgba(255,255,255,0.3)' : '#f3f4f6', padding: '1px 7px', borderRadius: '10px', fontSize: '11px' }}>{template.components?.length || 0}</span>}
          </button>
        ))}
      </div>

      {/* Preview Tab */}
      {activeTab === 'preview' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: template.orientation === 'landscape' ? '700px' : '500px',
            minHeight: template.orientation === 'landscape' ? '500px' : '700px',
            background: 'white', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb', padding: '18px', position: 'relative',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: template.orientation === 'landscape' ? '460px' : '660px' }}>
              {(template.components || []).sort((a, b) => a.sortOrder - b.sortOrder).map(comp => {
                const styles = (comp.styles || {}) as any;
                const content = (comp.content || {}) as any;
                const baseStyle: React.CSSProperties = {
                  fontSize: content.fontSize || 10, color: styles.color || '#333',
                  textAlign: styles.textAlign || 'left', fontWeight: styles.fontWeight as any || 'normal',
                  backgroundColor: styles.bgColor || 'transparent',
                  border: styles.border, padding: '2px 4px', borderRadius: '2px',
                };

                switch (comp.type) {
                  case 'HEADER':
                    return <div key={comp.id} style={{ textAlign: 'center', padding: '6px 10px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>{content.text || template.name}</div>;
                  case 'DIVIDER':
                    return <div key={comp.id} style={{ height: '1px', background: styles.color || '#ccc', margin: '2px 0' }} />;
                  case 'SCHOOL_LOGO':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'center', padding: '4px' }}>
                      <div style={{ width: '40px', height: '40px', background: `linear-gradient(135deg, ${template.primaryColor || '#1a365d'}, ${template.secondaryColor || '#ccc'})`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '16px', fontWeight: 700 }}>S</div>
                    </div>;
                  case 'SCHOOL_NAME':
                    return <div key={comp.id} style={{ ...baseStyle, fontSize: content.fontSize || 14, fontWeight: 'bold', textAlign: 'center', color: template.primaryColor || '#1a365d' }}>[School Name]</div>;
                  case 'STUDENT_INFO':
                    return <div key={comp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', fontSize: '9px', color: '#666' }}>
                      <span>Name: ____________________</span><span>Grade: ____</span>
                      <span>DOB: __________</span><span>Gender: ____</span>
                    </div>;
                  case 'ATTENDANCE_TABLE':
                    return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '4px 6px', fontSize: '9px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '3px 6px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '3px', fontWeight: 600 }}>
                        <span>Attendance Record</span><span style={{ marginLeft: 'auto', opacity: 0.8 }}>Present: _/__</span>
                      </div>
                    </div>;
                  case 'SUBJECT_TABLE':
                  case 'RESULTS_TABLE':
                    return <div key={comp.id} style={{ flex: 1, background: '#f9fafb', borderRadius: '4px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9px' }}>
                      <div style={{ display: 'flex', gap: '4px', padding: '3px 6px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '3px', fontWeight: 600 }}>
                        {['Subject', 'Score', 'Grade', 'Remark'].map(h => <div key={h} style={{ flex: 1 }}>{h}</div>)}
                      </div>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: '4px', padding: '3px 6px', background: i % 2 === 0 ? 'white' : '#f3f4f6', borderRadius: '2px' }}>
                          <div style={{ flex: 1, color: '#333' }}>Subject {i + 1}</div>
                          <div style={{ flex: 1, color: i < 3 ? '#059669' : '#dc2626' }}>{[75, 82, 68, 91, 54, 88][i]}%</div>
                          <div style={{ flex: 0.6, color: '#555' }}>{['A', 'A', 'B+', 'A*', 'C', 'A'][i]}</div>
                          <div style={{ flex: 1, color: '#777', fontSize: '8px' }}>{['Excellent', 'Very Good', 'Good', 'Outstanding', 'Fair', 'Excellent'][i]}</div>
                        </div>
                      ))}
                    </div>;
                  case 'TEACHER_REMARKS':
                    return <div key={comp.id} style={{ background: '#fefce8', borderRadius: '4px', padding: '4px 8px', border: '1px solid #fde68a', fontSize: '9px' }}>
                      <span style={{ color: '#854d0e' }}>Teacher Remarks: [Student] has shown satisfactory progress this term.</span>
                    </div>;
                  case 'SIGNATURE':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', marginTop: '4px' }}>
                      <div style={{ textAlign: 'center', width: '120px' }}>
                        <div style={{ height: '20px', borderTop: '1px solid #999', marginBottom: '2px' }} />
                        <div style={{ fontSize: '8px', color: '#999' }}>{content.label || 'Signature'}</div>
                      </div>
                    </div>;
                  case 'FOOTER':
                    return <div key={comp.id} style={{ textAlign: 'center', padding: '3px', fontSize: '7px', color: '#999', borderTop: '1px solid #e5e7eb', marginTop: 'auto' }}>
                      {content.text || `Template Preview — ${template.pageSize || 'A4'} ${template.orientation || 'portrait'}`}
                    </div>;
                  case 'QR_CODE':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px' }}>
                      <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '4px', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa fa-qrcode" style={{ fontSize: '16px', color: '#333' }} />
                      </div>
                    </div>;
                  default:
                    return <div key={comp.id} style={{ ...baseStyle, fontSize: '9px', padding: '4px 8px', background: '#f3f4f6', borderRadius: '4px', color: '#999' }}>
                      <i className="fa fa-puzzle-piece" style={{ marginRight: '4px' }} />{comp.label || comp.type}
                    </div>;
                }
              })}
            </div>
          </div>
          {(!template.components || template.components.length === 0) && (
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '16px' }}>No components configured for this template.</p>
          )}
        </div>
      )}

      {/* Components Tab */}
      {activeTab === 'components' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa fa-puzzle-piece" style={{ color: '#ea6645' }}></i>
              Components ({template.components?.length || 0})
            </h3>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
              {(template.components || []).sort((a, b) => a.sortOrder - b.sortOrder).map((comp, idx) => (
                <div key={comp.id} className="comp-item" style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                  background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6',
                }}>
                  <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`fa fa-${getComponentIcon(comp.type)}`} style={{ fontSize: '14px', color: '#7c3aed' }}></i>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>{comp.label || comp.type}</div>
                    <div style={{ fontSize: '11px', color: '#9ca3af' }}>{comp.type} · Order {comp.sortOrder}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-cog" style={{ color: '#ea6645' }}></i>Template Settings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Template Type', value: template.templateType },
              { label: 'Page Size', value: template.pageSize || 'A4' },
              { label: 'Orientation', value: template.orientation || 'portrait' },
              { label: 'Font Family', value: template.fontFamily || 'Arial' },
              { label: 'Font Size', value: `${template.fontSize || 11}px` },
              { label: 'Version', value: `v${template.version || 1}` },
              { label: 'Default', value: template.isDefault ? 'Yes' : 'No' },
              template.primaryColor ? { label: 'Primary Color', value: template.primaryColor, color: true } : null,
              template.secondaryColor ? { label: 'Secondary Color', value: template.secondaryColor, color: true } : null,
              template.category ? { label: 'Category', value: template.category.name } : null,
            ].filter(Boolean).map((setting: any) => (
              <div key={setting.label} style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{setting.label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#1f2937', textTransform: 'capitalize' }}>
                  {setting.color ? (
                    <><div style={{ width: '16px', height: '16px', borderRadius: '4px', background: setting.value, border: '1px solid #e5e7eb' }}></div>{setting.value}</>
                  ) : setting.value}
                </div>
              </div>
            ))}
          </div>
          {template.certificate && (
            <div style={{ marginTop: '24px', padding: '20px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#92400e', margin: '0 0 12px' }}><i className="fa fa-certificate" style={{ marginRight: '8px' }}></i>Certificate Settings</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', fontSize: '12px' }}>
                <div><strong>Type:</strong> {template.certificate.certificateType}</div>
                <div><strong>Border:</strong> {template.certificate.borderStyle}</div>
                <div><strong>QR Code:</strong> {template.certificate.showQrCode ? 'Yes' : 'No'}</div>
                <div><strong>Badge:</strong> {template.certificate.showBadge ? template.certificate.badgeStyle : 'No'}</div>
                <div><strong>Watermark:</strong> {template.certificate.showWatermark ? 'Yes' : 'No'}</div>
                <div><strong>Auto Numbering:</strong> {template.certificate.autoNumbering ? 'Yes' : 'No'}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
