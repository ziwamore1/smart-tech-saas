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
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '24px', minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: template.orientation === 'landscape' ? '700px' : '500px',
            minHeight: template.orientation === 'landscape' ? '500px' : '700px',
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
            position: 'relative',
            border: '1px solid #e5e7eb',
            padding: '18px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: template.orientation === 'landscape' ? '460px' : '660px' }}>
              {(template.components || []).sort((a, b) => a.sortOrder - b.sortOrder).map(comp => {
                const styles = (comp.styles || {}) as any;
                const content = (comp.content || {}) as any;
                const baseStyle: React.CSSProperties = {
                  fontSize: content.fontSize || 10,
                  color: styles.color || '#333',
                  textAlign: styles.textAlign || 'left',
                  fontWeight: styles.fontWeight as any || 'normal',
                  backgroundColor: styles.bgColor || 'transparent',
                  border: styles.border,
                  padding: '2px 4px',
                  borderRadius: '2px',
                };

                switch (comp.type) {
                  case 'HEADER':
                    return <div key={comp.id} style={{ textAlign: 'center', padding: '6px 10px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px' }}>{content.text || template.name}</div>;
                  case 'DIVIDER':
                    return <div key={comp.id} style={{ height: '1px', background: styles.color || '#ccc', margin: '2px 0' }} />;
                  case 'SCHOOL_LOGO':
                    return <div key={comp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                      <div style={{ width: '40px', height: '40px', background: `linear-gradient(135deg, ${template.primaryColor || '#1a365d'}, ${template.secondaryColor || '#ccc'})`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '16px', fontWeight: 700 }}>S</div>
                    </div>;
                  case 'SCHOOL_NAME':
                    return <div key={comp.id} style={{ ...baseStyle, fontSize: content.fontSize || 14, fontWeight: 'bold', textAlign: 'center', color: template.primaryColor || '#1a365d' }}>[School Name]</div>;
                  case 'SCHOOL_INFO':
                    return <div key={comp.id} style={{ ...baseStyle, fontSize: 9, textAlign: 'center', color: '#999' }}>123 Education Ave · Lusaka · Zambia · info@school.edu.zm</div>;
                  case 'STUDENT_PHOTO':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px' }}>
                      <div style={{ width: '50px', height: '60px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d1d5db' }}>
                        <i className="fa fa-camera" style={{ fontSize: '14px', color: '#9ca3af' }} />
                      </div>
                    </div>;
                  case 'STUDENT_INFO':
                    return <div key={comp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', fontSize: '9px', color: '#666' }}>
                      <span>Name: ____________________</span>
                      <span>Grade: ____</span>
                      <span>DOB: __________</span>
                      <span>Gender: ____</span>
                    </div>;
                  case 'ATTENDANCE_TABLE':
                    return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '4px 6px', fontSize: '9px' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '3px 6px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '3px', fontWeight: 600, marginBottom: '3px' }}>
                        <span>Attendance Record</span>
                        <span style={{ marginLeft: 'auto', opacity: 0.8 }}>Present: _/__</span>
                      </div>
                    </div>;
                  case 'SUBJECT_TABLE':
                  case 'RESULTS_TABLE':
                    return <div key={comp.id} style={{ flex: 1, background: '#f9fafb', borderRadius: '4px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9px' }}>
                      <div style={{ display: 'flex', gap: '4px', padding: '3px 6px', background: template.primaryColor || '#1a365d', color: 'white', borderRadius: '3px', fontWeight: 600 }}>
                        {['Subject', 'Score', 'Grade', 'Remark'].map(h => <div key={h} style={{ flex: 1 }}>{h}</div>)}
                      </div>
                      {Array.from({ length: Math.min(6, 12) }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: '4px', padding: '3px 6px', background: i % 2 === 0 ? 'white' : '#f3f4f6', borderRadius: '2px' }}>
                          <div style={{ flex: 1, color: '#333' }}>{content.showScore !== false ? `Subject ${i + 1}` : '—'}</div>
                          <div style={{ flex: 1, color: i < 3 ? '#059669' : '#dc2626' }}>{content.showScore !== false ? `${[75, 82, 68, 91, 54, 88][i] || 70}%` : '—'}</div>
                          <div style={{ flex: 0.6, color: '#555' }}>{content.showGrade !== false ? ['A', 'A', 'B+', 'A*', 'C', 'A'][i] || 'B' : '—'}</div>
                          <div style={{ flex: 1, color: '#777', fontSize: '8px' }}>{content.showRemark !== false ? ['Excellent', 'Very Good', 'Good', 'Outstanding', 'Fair', 'Excellent'][i] || '—' : '—'}</div>
                        </div>
                      ))}
                    </div>;
                  case 'RANKING_TABLE':
                    return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '3px 8px', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#555' }}>
                      <span>Position: 5 / 42</span>
                      <span>Total Students: 42</span>
                    </div>;
                  case 'PERFORMANCE_CHART':
                    return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '6px', height: '60px', display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'center' }}>
                      {[40, 65, 80, 55, 90, 70].map((h, i) => (
                        <div key={i} style={{ width: '20px', height: `${h}%`, background: `linear-gradient(to top, ${template.primaryColor || '#1a365d'}, ${template.primaryColor || '#1a365d'}88)`, borderRadius: '3px 3px 0 0', opacity: 0.7 }} />
                      ))}
                    </div>;
                  case 'ANALYTICS_SUMMARY':
                    return <div key={comp.id} style={{ background: '#f8fafc', borderRadius: '4px', padding: '4px 8px', fontSize: '9px', color: '#555' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        <span>Avg: 76.4%</span>
                        <span>Total: 535 pts</span>
                        {content.showGPA !== false && <span>GPA: 4.2</span>}
                      </div>
                    </div>;
                  case 'TEACHER_REMARKS':
                    return <div key={comp.id} style={{ background: '#fefce8', borderRadius: '4px', padding: '4px 8px', border: '1px solid #fde68a', fontSize: '9px' }}>
                      <i className="fa fa-comment" style={{ marginRight: '4px', color: '#a16207', fontSize: '8px' }} />
                      <span style={{ color: '#854d0e' }}>Teacher Remarks: [Student] has shown satisfactory progress this term. Keep up the good work.</span>
                    </div>;
                  case 'HEAD_TEACHER_REMARKS':
                    return <div key={comp.id} style={{ background: '#eff6ff', borderRadius: '4px', padding: '4px 8px', border: '1px solid #bfdbfe', fontSize: '9px' }}>
                      <i className="fa fa-comment-dots" style={{ marginRight: '4px', color: '#1d4ed8', fontSize: '8px' }} />
                      <span style={{ color: '#1e40af' }}>Head Teacher Remarks: Promising performance. Encourage continued effort in all subjects.</span>
                    </div>;
                  case 'PROMOTION_STATUS':
                    return <div key={comp.id} style={{ fontWeight: 'bold', fontSize: '10px', color: template.primaryColor || '#1a365d', padding: '2px 4px' }}>
                      Promotion Status: <span style={{ color: '#059669' }}>PROMOTED ✓</span>
                    </div>;
                  case 'SIGNATURE':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', marginTop: '4px' }}>
                      <div style={{ textAlign: 'center', width: '120px' }}>
                        <div style={{ height: '20px', borderTop: '1px solid #999', marginBottom: '2px' }} />
                        <div style={{ fontSize: '8px', color: '#999' }}>{content.label || 'Signature'}</div>
                      </div>
                    </div>;
                  case 'QR_CODE':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px' }}>
                      <div style={{ width: '32px', height: '32px', background: 'white', borderRadius: '4px', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa fa-qrcode" style={{ fontSize: '16px', color: '#333' }} />
                      </div>
                    </div>;
                  case 'FOOTER':
                    return <div key={comp.id} style={{ textAlign: 'center', padding: '3px', fontSize: '7px', color: '#999', borderTop: '1px solid #e5e7eb', marginTop: 'auto' }}>
                      {content.text || `Template Preview - ${template.pageSize || 'A4'} ${template.orientation || 'portrait'}`}
                    </div>;
                  case 'WATERMARK':
                    return <div key={comp.id} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', opacity: 0.04, fontSize: '60px', fontWeight: 'bold', color: styles.color || '#1a365d', transform: 'rotate(-30deg)' }}>
                      {content.text || 'CERTIFICATE'}
                    </div>;
                  case 'BORDER':
                    return <div key={comp.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: styles.border || '2px solid #1a365d', borderRadius: '8px', margin: '8px' }} />;
                  case 'AWARD_TEXT':
                    return <div key={comp.id} style={{ ...baseStyle, textAlign: 'center', fontSize: content.fontSize || 12, color: '#666', padding: '8px 0 2px' }}>{content.text || 'This certificate is awarded to'}</div>;
                  case 'CUSTOM_TEXT':
                    return <div key={comp.id} style={{ ...baseStyle, textAlign: 'center', fontSize: content.fontSize || 10, color: styles.color || '#777' }}>{content.text || 'Custom text'}</div>;
                  case 'STUDENT_NAME':
                    return <div key={comp.id} style={{ ...baseStyle, textAlign: content.textAlign || 'center', fontSize: content.fontSize || 20, fontWeight: 'bold', color: template.primaryColor || '#1a365d', padding: '8px 0' }}>John Doe</div>;
                  case 'BADGE':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'center', padding: '2px' }}>
                      <div style={{ width: '30px', height: '30px', background: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>
                        <i className="fa fa-star" />
                      </div>
                    </div>;
                  case 'STAMP':
                    return <div key={comp.id} style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px dashed #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '7px', fontWeight: 'bold', transform: 'rotate(-15deg)', opacity: 0.6 }}>
                        OFFICIAL
                      </div>
                    </div>;
                  case 'RECOMMENDATIONS':
                    return <div key={comp.id} style={{ background: '#fffbeb', borderRadius: '4px', padding: '4px 8px', border: '1px solid #fde68a', fontSize: '9px', color: '#92400e' }}>
                      <i className="fa fa-lightbulb" style={{ marginRight: '4px', color: '#f59e0b', fontSize: '8px' }} />
                      Recommendations: Focus on Mathematics and Science for improved performance.
                    </div>;
                  case 'COMPETENCY_HEATMAP':
                    return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '4px', fontSize: '7px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {[{ s: 'Reading', l: 85 }, { s: 'Writing', l: 70 }, { s: 'Math', l: 60 }, { s: 'Science', l: 90 }].map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ width: '50px', color: '#666' }}>{item.s}</span>
                          <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px' }}>
                            <div style={{ width: `${item.l}%`, height: '100%', background: item.l >= 80 ? '#22c55e' : item.l >= 60 ? '#f59e0b' : '#ef4444', borderRadius: '3px' }} />
                          </div>
                        </div>
                      ))}
                    </div>;
                  default:
                    return <div key={comp.id} style={{ ...baseStyle, fontSize: '9px', padding: '4px 8px', background: '#f3f4f6', borderRadius: '4px', color: '#999' }}>
                      <i className="fa fa-puzzle-piece" style={{ marginRight: '4px' }} />
                      {comp.label || comp.type} — Position ({comp.position?.x || 0}, {comp.position?.y || 0})
                    </div>;
                }
              })}
            </div>
          </div>
          {(!template.components || template.components.length === 0) && (
            <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '16px' }}>No components to display — this template has no components configured.</p>
          )}
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
