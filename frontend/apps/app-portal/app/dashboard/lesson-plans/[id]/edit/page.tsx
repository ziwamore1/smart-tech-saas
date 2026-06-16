'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { lessonPlansApi, type LessonPlanSection } from '@/lib/api';
import { SectionEditor } from '../../../../../components/lesson-plan-editor/SectionEditor';
import { SectionConfigurator } from '../../../../../components/lesson-plan-editor/SectionConfigurator';
import type { LessonPlanSectionData } from '../../../../../components/lesson-plan-editor/SectionEditor';

export default function LessonPlanEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [sections, setSections] = useState<LessonPlanSectionData[]>([]);
  const [config, setConfig] = useState({ customSections: true, allowReordering: true, showSectionTitles: true });
  const [tagsText, setTagsText] = useState('');
  const [originalData, setOriginalData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadPlan();
  }, [id]);

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await lessonPlansApi.getById(id);
      const plan = res.data || res;
      setOriginalData(plan);
      setTitle(plan.title || '');
      setDescription(plan.description || '');
      setStatus(plan.status || 'draft');
      setTagsText(plan.tags?.join(', ') || '');
      setConfig(plan.config || { customSections: true, allowReordering: true, showSectionTitles: true });

      if (plan.content && Array.isArray(plan.content) && plan.content.length > 0) {
        setSections(plan.content.map((s: any) => ({
          id: s.id || `sec-${Date.now()}`,
          type: s.type || 'custom',
          title: s.title || 'Section',
          content: s.content || '<p></p>',
          order: s.order ?? 0,
          config: s.config,
        })));
      } else {
        const defaultSections: LessonPlanSectionData[] = [];
        const addIfHasContent = (type: string, title: string, content: string) => {
          if (content) defaultSections.push({ id: `sec-${type}`, type, title, content, order: defaultSections.length });
        };
        addIfHasContent('objectives', 'Learning Objectives',
          plan.objectives?.length ? `<ul>${plan.objectives.map((o: string) => `<li>${o}</li>`).join('')}</ul>` : '');
        addIfHasContent('materials', 'Materials Needed', plan.materials || '');
        addIfHasContent('procedures', 'Procedures', plan.procedures || '');
        addIfHasContent('assessment', 'Assessment', plan.assessment || '');
        addIfHasContent('notes', 'Notes', plan.notes || '');
        if (defaultSections.length === 0) {
          defaultSections.push({
            id: 'sec-objectives', type: 'objectives', title: 'Learning Objectives',
            content: '<p>By the end of this lesson, students will be able to...</p>', order: 0,
          });
        }
        setSections(defaultSections);
      }
    } catch (e) {
      console.error('Failed to load lesson plan:', e);
      setError('Failed to load lesson plan. It may have been deleted or you may not have permission.');
    } finally {
      setLoading(false);
    }
  };

  const handleSectionChange = useCallback((index: number, updated: LessonPlanSectionData) => {
    setSections((prev) => prev.map((s, i) => (i === index ? updated : s)));
  }, []);

  const handleSectionDelete = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSectionOrderChange = useCallback((orderedSections: LessonPlanSectionData[]) => {
    setSections(orderedSections.map((s, i) => ({ ...s, order: i })));
  }, []);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        tags: tagsText.split(',').map((t) => t.trim()).filter(Boolean),
        config,
        content: sections.map((s) => ({
          id: s.id,
          type: s.type,
          title: s.title,
          content: s.content,
          order: s.order,
          config: s.config,
        })),
      };

      await lessonPlansApi.update(id, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save lesson plan:', e);
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    router.push('/dashboard/lesson-plans');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <button onClick={handleGoBack} style={{ padding: '10px 16px', background: 'none', border: '1px solid #e8ddd0', borderRadius: '8px', cursor: 'pointer', width: 'fit-content', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#374151' }}>
          <i className="fa fa-arrow-left" /> Back to Lesson Plans
        </button>
        <div style={{ background: '#FEF2F2', padding: '24px', borderRadius: '12px', border: '1px solid #FECACA', textAlign: 'center' }}>
          <h3 style={{ color: '#991B1B', margin: '0 0 8px' }}>Error</h3>
          <p style={{ color: '#B91C1C' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <style>{`
        .lp-editor input:focus, .lp-editor textarea:focus, .lp-editor select:focus {
          outline: none; border-color: #ea6645; box-shadow: 0 0 0 3px rgba(234, 102, 69, 0.15);
        }
        .lp-editor button:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={handleGoBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: '8px', borderRadius: '8px' }} title="Back">
            <i className="fa fa-arrow-left" style={{ fontSize: '18px' }} />
          </button>
          <div>
            <input
              type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson Plan Title"
              style={{
                fontSize: '22px', fontWeight: 700, color: '#1F2937', border: 'none',
                background: 'transparent', outline: 'none', width: '400px', maxWidth: '60vw',
              }}
            />
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
              <span>ID: {id.slice(0, 8)}...</span>
              <span>|</span>
              <span>Updated: {originalData?.updatedAt ? new Date(originalData.updatedAt).toLocaleString() : '—'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Completed</option>
          </select>
          <span style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
            background: saved ? '#D1FAE5' : saving ? '#FEF3C7' : '#F3F4F6',
            color: saved ? '#065F46' : saving ? '#92400E' : '#6B7280',
            transition: 'all 0.3s',
          }}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Unsaved'}
          </span>
          <button onClick={handleSave} disabled={saving || !title.trim()}
            style={{
              padding: '10px 24px', background: '#ea6645', color: 'white', border: 'none',
              borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(234, 102, 69, 0.3)',
            }}>
            <i className="fa fa-save" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Description & Tags */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '2', minWidth: '280px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Description</label>
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this lesson..."
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Tags</label>
            <input
              type="text" value={tagsText} onChange={(e) => setTagsText(e.target.value)}
              placeholder="math, algebra, grade7"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '4px 0 0' }}>Comma-separated tags</p>
          </div>
        </div>
      </div>

      {/* Main Editor Area */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Sidebar - Section Configurator */}
        <div style={{ flex: '0 0 280px', minWidth: '240px' }}>
          <div style={{ position: 'sticky', top: '16px' }}>
            <SectionConfigurator
              sections={sections}
              onChange={handleSectionOrderChange}
            />
            {/* Quick actions */}
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '16px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa fa-info-circle" /> Info
              </h3>
              <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.6 }}>
                <p><strong>Class:</strong> {originalData?.class?.name || '—'}</p>
                <p><strong>Subject:</strong> {originalData?.subject?.name || '—'}</p>
                <p><strong>Week:</strong> {originalData?.weekStart ? new Date(originalData.weekStart).toLocaleDateString() : '—'} — {originalData?.weekEnd ? new Date(originalData.weekEnd).toLocaleDateString() : '—'}</p>
                <p><strong>Created by:</strong> {originalData?.createdBy?.firstName} {originalData?.createdBy?.lastName}</p>
                <p><strong>Sections:</strong> {sections.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Section Editors */}
        <div style={{ flex: '1', minWidth: '300px' }}>
          {sections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#FEFCF9', borderRadius: '12px', border: '1px dashed #D1D5DB' }}>
              <i className="fa fa-file-text-o" style={{ fontSize: '48px', color: '#D1D5DB', marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937', marginBottom: '8px' }}>No Sections Yet</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px' }}>Add sections from the sidebar to build your lesson plan.</p>
            </div>
          ) : (
            sections.map((section, index) => (
              <SectionEditor
                key={section.id}
                section={section}
                onChange={(updated) => handleSectionChange(index, updated)}
                onDelete={() => handleSectionDelete(index)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
