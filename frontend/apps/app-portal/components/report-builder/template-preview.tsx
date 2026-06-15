'use client';

interface TemplatePreviewProps {
  template: {
    name: string;
    templateType: string;
    pageSize?: string;
    orientation?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
    components?: any[];
    certificate?: any;
  };
  height?: number;
  width?: number;
}

function renderComponent(comp: any, template: any) {
  const styles = (comp.styles || {}) as any;
  const content = (comp.content || {}) as any;
  const primaryColor = template.primaryColor || '#1a365d';
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
      return <div key={comp.id} style={{ textAlign: 'center', padding: '6px 10px', background: primaryColor, color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.3px' }}>{content.text || template.name}</div>;
    case 'DIVIDER':
      return <div key={comp.id} style={{ height: '1px', background: styles.color || '#ccc', margin: '2px 0' }} />;
    case 'SCHOOL_LOGO':
      return <div key={comp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
        <div style={{ width: '40px', height: '40px', background: `linear-gradient(135deg, ${primaryColor}, ${template.secondaryColor || '#ccc'})`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '16px', fontWeight: 700 }}>S</div>
      </div>;
    case 'SCHOOL_NAME':
      return <div key={comp.id} style={{ ...baseStyle, fontSize: content.fontSize || 14, fontWeight: 'bold', textAlign: 'center', color: primaryColor }}>[School Name]</div>;
    case 'SCHOOL_INFO':
      return <div key={comp.id} style={{ ...baseStyle, fontSize: 9, textAlign: 'center', color: '#999' }}>123 Education Ave · Lusaka · info@school.edu.zm</div>;
    case 'STUDENT_PHOTO':
      return <div key={comp.id} style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px' }}>
        <div style={{ width: '50px', height: '60px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #d1d5db' }}>
          <i className="fa fa-camera" style={{ fontSize: '14px', color: '#9ca3af' }} />
        </div>
      </div>;
    case 'STUDENT_INFO':
      return <div key={comp.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px', fontSize: '9px', color: '#666' }}>
        <span>Name: ____________________</span><span>Grade: ____</span>
        <span>DOB: __________</span><span>Gender: ____</span>
      </div>;
    case 'STUDENT_NAME':
      return <div key={comp.id} style={{ ...baseStyle, textAlign: 'center', fontSize: content.fontSize || 20, fontWeight: 'bold', color: primaryColor, padding: '8px 0' }}>John Doe</div>;
    case 'ATTENDANCE_TABLE':
      return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '4px 6px', fontSize: '9px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '3px 6px', background: primaryColor, color: 'white', borderRadius: '3px', fontWeight: 600, marginBottom: '3px' }}>
          <span>Attendance Record</span>
          <span style={{ marginLeft: 'auto', opacity: 0.8 }}>Present: _/__</span>
        </div>
      </div>;
    case 'SUBJECT_TABLE':
    case 'RESULTS_TABLE':
      return <div key={comp.id} style={{ flex: 1, background: '#f9fafb', borderRadius: '4px', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '9px' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '3px 6px', background: primaryColor, color: 'white', borderRadius: '3px', fontWeight: 600 }}>
          {['Subject', 'Score', 'Grade', 'Remark'].map(h => <div key={h} style={{ flex: 1 }}>{h}</div>)}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
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
        <span>Position: 5 / 42</span><span>Total Students: 42</span>
      </div>;
    case 'PERFORMANCE_CHART':
      return <div key={comp.id} style={{ background: '#f9fafb', borderRadius: '4px', padding: '6px', height: '60px', display: 'flex', alignItems: 'flex-end', gap: '4px', justifyContent: 'center' }}>
        {[40, 65, 80, 55, 90, 70].map((h, i) => (
          <div key={i} style={{ width: '20px', height: `${h}%`, background: `linear-gradient(to top, ${primaryColor}, ${primaryColor}88)`, borderRadius: '3px 3px 0 0', opacity: 0.7 }} />
        ))}
      </div>;
    case 'ANALYTICS_SUMMARY':
      return <div key={comp.id} style={{ background: '#f8fafc', borderRadius: '4px', padding: '4px 8px', fontSize: '9px', color: '#555' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          <span>Avg: 76.4%</span><span>Total: 535 pts</span>
          {content.showGPA !== false && <span>GPA: 4.2</span>}
        </div>
      </div>;
    case 'TEACHER_REMARKS':
      return <div key={comp.id} style={{ background: '#fefce8', borderRadius: '4px', padding: '4px 8px', border: '1px solid #fde68a', fontSize: '9px' }}>
        <i className="fa fa-comment" style={{ marginRight: '4px', color: '#a16207', fontSize: '8px' }} />
        <span style={{ color: '#854d0e' }}>Teacher Remarks: [Student] has shown satisfactory progress this term.</span>
      </div>;
    case 'HEAD_TEACHER_REMARKS':
      return <div key={comp.id} style={{ background: '#eff6ff', borderRadius: '4px', padding: '4px 8px', border: '1px solid #bfdbfe', fontSize: '9px' }}>
        <i className="fa fa-comment-dots" style={{ marginRight: '4px', color: '#1d4ed8', fontSize: '8px' }} />
        <span style={{ color: '#1e40af' }}>Head Teacher: Promising performance. Encourage continued effort.</span>
      </div>;
    case 'PROMOTION_STATUS':
      return <div key={comp.id} style={{ fontWeight: 'bold', fontSize: '10px', color: primaryColor, padding: '2px 4px' }}>
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
        {content.text || `${template.pageSize || 'A4'} ${template.orientation || 'portrait'} · Preview`}
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
      return <div key={comp.id} style={{ ...baseStyle, textAlign: 'center', fontSize: content.fontSize || 10 }}>{content.text || 'Custom text'}</div>;
    case 'BADGE':
      return <div key={comp.id} style={{ display: 'flex', justifyContent: 'center', padding: '2px' }}>
        <div style={{ width: '30px', height: '30px', background: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '14px' }}>
          <i className="fa fa-star" />
        </div>
      </div>;
    case 'STAMP':
      return <div key={comp.id} style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px dashed #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '7px', fontWeight: 'bold', transform: 'rotate(-15deg)', opacity: 0.6 }}>OFFICIAL</div>
      </div>;
    case 'RECOMMENDATIONS':
      return <div key={comp.id} style={{ background: '#fffbeb', borderRadius: '4px', padding: '4px 8px', border: '1px solid #fde68a', fontSize: '9px', color: '#92400e' }}>
        <i className="fa fa-lightbulb" style={{ marginRight: '4px', color: '#f59e0b', fontSize: '8px' }} />
        Recommendations: Focus on Mathematics and Science.
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
        {comp.label || comp.type} — ({comp.position?.x || 0}, {comp.position?.y || 0})
      </div>;
  }
}

export function TemplatePreview({ template, height, width }: TemplatePreviewProps) {
  const pageWidth = width || (template.orientation === 'landscape' ? 700 : 500);
  const pageHeight = height || (template.orientation === 'landscape' ? 500 : 700);

  return (
    <div style={{
      width: pageWidth,
      minHeight: pageHeight,
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      position: 'relative',
      border: '1px solid #e5e7eb',
      padding: '18px',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: pageHeight - 36 }}>
        {(template.components || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((comp: any) => renderComponent(comp, template))}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: any;
  onPreview?: (id: string) => void;
  onApply?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function TemplateCard({ template, onPreview, onApply, onDuplicate }: TemplateCardProps) {
  const primaryColor = template.primaryColor || '#1a365d';

  return (
    <div style={{
      background: '#fefcf9',
      borderRadius: '16px',
      border: '1px solid #f3f4f6',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        height: '120px',
        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: '48px', height: '48px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <i className="fa fa-file-alt" style={{ fontSize: '22px', color: 'white' }}></i>
        </div>
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          padding: '3px 8px', background: 'rgba(255,255,255,0.2)',
          borderRadius: '12px', fontSize: '10px', fontWeight: 600, color: 'white',
          textTransform: 'capitalize', backdropFilter: 'blur(4px)',
        }}>
          {template.templateType?.replace(/_/g, ' ')}
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>{template.name}</h3>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, overflow: 'hidden' }}>
          {template.description || 'Professional report template'}
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onPreview && <ActionButton icon="eye" label="Preview" onClick={() => onPreview(template.id)} color="#7c3aed" />}
          {onApply && <ActionButton icon="check" label="Apply" onClick={() => onApply(template.id)} color="#059669" />}
          {onDuplicate && <ActionButton icon="copy" label="Duplicate" onClick={() => onDuplicate(template.id)} color="#2563eb" />}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '6px 12px', border: 'none', borderRadius: '6px',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = 'white'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.color = color; }}
    >
      <i className={`fa fa-${icon}`}></i> {label}
    </button>
  );
}
