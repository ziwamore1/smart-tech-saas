'use client';
import { useState } from 'react';
import LessonPlanRichTextEditor from './RichTextEditor';

export interface LessonPlanSectionData {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
  config?: Record<string, any>;
}

interface SectionEditorProps {
  section: LessonPlanSectionData;
  onChange: (section: LessonPlanSectionData) => void;
  onDelete: () => void;
}

export function SectionEditor({ section, onChange, onDelete }: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{
      background: '#fefcf9', borderRadius: '12px', border: '1px solid #e8ddd0',
      overflow: 'hidden', marginBottom: '12px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
        background: '#f5efe8', borderBottom: collapsed ? 'none' : '1px solid #e8ddd0',
      }}>
        <i className="fa fa-grip-vertical" style={{ color: '#9CA3AF', cursor: 'grab', fontSize: '16px' }} />
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            style={{
              border: 'none', background: 'transparent', fontSize: '14px', fontWeight: 700,
              color: '#1F2937', outline: 'none', width: '100%', padding: '2px 0',
            }}
            placeholder="Section title..."
          />
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 600, color: '#6B7280', background: '#E5E7EB',
          padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase',
        }}>{section.type}</span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '4px' }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <i className={`fa ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
        </button>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px' }}
          title="Delete section"
        >
          <i className="fa fa-trash-o" />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px' }}>
          <LessonPlanRichTextEditor
            content={section.content}
            onChange={(html) => onChange({ ...section, content: html })}
            placeholder={`Enter content for ${section.title}...`}
            minHeight="200px"
          />
        </div>
      )}
    </div>
  );
}
