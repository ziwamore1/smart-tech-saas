'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { lessonPlansApi } from '@/lib/api';

interface Section {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
}

const SECTION_TEMPLATES = [
  { type: 'objectives', title: 'Learning Objectives', placeholder: 'By the end of this lesson, students will be able to...' },
  { type: 'materials', title: 'Materials Needed', placeholder: 'List required materials...' },
  { type: 'procedures', title: 'Procedures', placeholder: 'Step-by-step procedures...' },
  { type: 'assessment', title: 'Assessment', placeholder: 'How will learning be assessed?' },
  { type: 'notes', title: 'Notes', placeholder: 'Additional notes...' },
  { type: 'homework', title: 'Homework', placeholder: 'Assign homework...' },
  { type: 'differentiation', title: 'Differentiation', placeholder: 'Support for different learning needs...' },
];

export default function LessonPlanEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadPlan();
  }, [id]);

  const loadPlan = async () => {
    setLoading(true);
    try {
      const res = await lessonPlansApi.getById(id);
      const plan = res.data || res;
      setTitle(plan.title || '');
      setDescription(plan.description || '');
      setStatus(plan.status || 'draft');

      if (plan.content && Array.isArray(plan.content) && plan.content.length > 0) {
        setSections(plan.content.map((s: any) => ({
          id: s.id || `sec-${Date.now()}`,
          type: s.type || 'custom',
          title: s.title || 'Section',
          content: s.content || '',
          order: s.order ?? 0,
        })));
      } else {
        const defaultSections: Section[] = [];
        const addIfHas = (type: string, title: string, content: string) => {
          if (content) defaultSections.push({ id: `sec-${type}`, type, title, content, order: defaultSections.length });
        };
        addIfHas('objectives', 'Learning Objectives', plan.objectives?.length ? `<ul>${plan.objectives.map((o: string) => `<li>${o}</li>`).join('')}</ul>` : '');
        addIfHas('materials', 'Materials Needed', plan.materials || '');
        addIfHas('procedures', 'Procedures', plan.procedures || '');
        addIfHas('assessment', 'Assessment', plan.assessment || '');
        addIfHas('notes', 'Notes', plan.notes || '');
        if (defaultSections.length === 0) {
          defaultSections.push({ id: 'sec-objectives', type: 'objectives', title: 'Learning Objectives', content: 'By the end of this lesson, students will be able to...', order: 0 });
        }
        setSections(defaultSections);
      }
    } catch (e) {
      setError('Failed to load lesson plan.');
    } finally {
      setLoading(false);
    }
  };

  const updateSection = (index: number, field: keyof Section, value: string) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const addSection = (type: string, title: string) => {
    const template = SECTION_TEMPLATES.find((s) => s.type === type);
    setSections((prev) => [...prev, { id: `sec-${Date.now()}`, type, title, content: '', order: prev.length }]);
  };

  const moveSection = (index: number, dir: 'up' | 'down') => {
    const newIndex = dir === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSections(updated.map((s, i) => ({ ...s, order: i })));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await lessonPlansApi.update(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        content: sections.map((s) => ({ id: s.id, type: s.type, title: s.title, content: s.content, order: s.order })),
        config: { customSections: true, allowReordering: true, showSectionTitles: true },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  const availableTypes = SECTION_TEMPLATES.filter((t) => !sections.some((s) => s.type === t.type) || t.type === 'custom');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => router.push('/dashboard/lesson-plans')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '8px' }}>
            <i className="fa fa-arrow-left" style={{ fontSize: '18px' }} />
          </button>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Lesson Plan Title"
            style={{ fontSize: '22px', fontWeight: 700, color: '#1F2937', border: 'none', background: 'transparent', outline: 'none', width: '400px', maxWidth: '50vw' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
          </select>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: saved ? '#D1FAE5' : saving ? '#FEF3C7' : '#F3F4F6', color: saved ? '#065F46' : saving ? '#92400E' : '#6B7280' }}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Unsaved'}
          </span>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            style={{ padding: '10px 24px', background: '#ea6645', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-save" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '8px', border: '1px solid #FECACA', color: '#991B1B', fontSize: '14px' }}>{error}</div>
      )}

      {/* Section controls */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '12px 16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', padding: '6px 0', marginRight: '8px' }}>Add Section:</span>
        {availableTypes.map((t) => (
          <button key={t.type} onClick={() => addSection(t.type, t.title)}
            style={{ padding: '6px 12px', border: '1px dashed #D1D5DB', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px', color: '#374151' }}>
            <i className="fa fa-plus" style={{ marginRight: '4px', fontSize: '10px' }} /> {t.title}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {sections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', background: '#FEFCF9', borderRadius: '12px', border: '1px dashed #D1D5DB' }}>
            <p style={{ color: '#6B7280' }}>No sections yet. Add sections above.</p>
          </div>
        ) : (
          sections.map((section, index) => (
            <div key={section.id} style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <i className="fa fa-grip-vertical" style={{ color: '#D1D5DB', fontSize: '14px' }} />
                <input type="text" value={section.title} onChange={(e) => updateSection(index, 'title', e.target.value)}
                  style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '14px', fontWeight: 700, color: '#1F2937', outline: 'none' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#6B7280', background: '#E5E7EB', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>{section.type}</span>
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button onClick={() => moveSection(index, 'up')} disabled={index === 0} style={{ background: 'none', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? '#D1D5DB' : '#6B7280', padding: '4px' }}><i className="fa fa-chevron-up" style={{ fontSize: '12px' }} /></button>
                  <button onClick={() => moveSection(index, 'down')} disabled={index === sections.length - 1} style={{ background: 'none', border: 'none', cursor: index === sections.length - 1 ? 'not-allowed' : 'pointer', color: index === sections.length - 1 ? '#D1D5DB' : '#6B7280', padding: '4px' }}><i className="fa fa-chevron-down" style={{ fontSize: '12px' }} /></button>
                </div>
                <button onClick={() => removeSection(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px' }}><i className="fa fa-trash-o" /></button>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <textarea value={section.content} onChange={(e) => updateSection(index, 'content', e.target.value)}
                  placeholder="Enter content..."
                  rows={6}
                  style={{ width: '100%', padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  Tip: Use HTML tags for rich content (&lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;ul&gt;&lt;li&gt;lists&lt;/li&gt;&lt;/ul&gt;, &lt;table&gt;tables&lt;/table&gt;)
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
