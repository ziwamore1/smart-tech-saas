'use client';
import { useCallback } from 'react';
import type { LessonPlanSectionData } from './SectionEditor';

interface SectionConfiguratorProps {
  sections: LessonPlanSectionData[];
  onChange: (sections: LessonPlanSectionData[]) => void;
}

const PREDEFINED_SECTION_TYPES = [
  { type: 'objectives', title: 'Learning Objectives', icon: 'fa-bullseye' },
  { type: 'materials', title: 'Materials Needed', icon: 'fa-cube' },
  { type: 'procedures', title: 'Procedures', icon: 'fa-list-ol' },
  { type: 'assessment', title: 'Assessment', icon: 'fa-check-circle' },
  { type: 'notes', title: 'Notes', icon: 'fa-sticky-note' },
  { type: 'homework', title: 'Homework', icon: 'fa-book' },
  { type: 'differentiation', title: 'Differentiation', icon: 'fa-users' },
  { type: 'custom', title: 'Custom Section', icon: 'fa-plus-circle' },
];

export function SectionConfigurator({ sections, onChange }: SectionConfiguratorProps) {
  const addSection = useCallback((type: string, title: string) => {
    const newSection: LessonPlanSectionData = {
      id: `sec-${Date.now()}`,
      type,
      title,
      content: '<p></p>',
      order: sections.length,
    };
    onChange([...sections, newSection]);
  }, [sections, onChange]);

  const moveSection = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated.map((s, i) => ({ ...s, order: i })));
  }, [sections, onChange]);

  const availableTypes = PREDEFINED_SECTION_TYPES.filter(
    (pt) => !sections.some((s) => s.type === pt.type && pt.type !== 'custom')
  );

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB',
      padding: '16px', marginBottom: '16px',
    }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="fa fa-cog" /> Sections
      </h3>

      {sections.length === 0 && (
        <p style={{ fontSize: '13px', color: '#9CA3AF', marginBottom: '12px' }}>
          No sections yet. Add sections below to build your lesson plan.
        </p>
      )}

      {sections.map((section, index) => (
        <div key={section.id} style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
          background: '#F9FAFB', borderRadius: '8px', marginBottom: '6px',
          border: '1px solid #F3F4F6',
        }}>
          <i className="fa fa-grip-vertical" style={{ color: '#D1D5DB', cursor: 'grab', fontSize: '14px' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151', flex: 1 }}>{section.title}</span>
          <span style={{
            fontSize: '10px', fontWeight: 600, color: '#6B7280', background: '#E5E7EB',
            padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase',
          }}>{section.type}</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <button
              onClick={() => moveSection(index, 'up')}
              disabled={index === 0}
              style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#D1D5DB' : '#6B7280', padding: '4px' }}
            >
              <i className="fa fa-chevron-up" style={{ fontSize: '12px' }} />
            </button>
            <button
              onClick={() => moveSection(index, 'down')}
              disabled={index === sections.length - 1}
              style={{ background: 'none', border: 'none', cursor: index === sections.length - 1 ? 'not-allowed' : 'pointer', color: index === sections.length - 1 ? '#D1D5DB' : '#6B7280', padding: '4px' }}
            >
              <i className="fa fa-chevron-down" style={{ fontSize: '12px' }} />
            </button>
          </div>
        </div>
      ))}

      {availableTypes.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px' }}>Add Section</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {availableTypes.map((pt) => (
              <button
                key={pt.type}
                onClick={() => addSection(pt.type, pt.title)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                  border: '1px dashed #D1D5DB', borderRadius: '6px', background: 'white',
                  cursor: 'pointer', fontSize: '12px', color: '#374151', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ea6645'; e.currentTarget.style.color = '#ea6645'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.color = '#374151'; }}
              >
                <i className={`fa ${pt.icon}`} style={{ fontSize: '11px' }} />
                {pt.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
