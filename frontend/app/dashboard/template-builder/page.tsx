'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Rnd } from 'react-rnd';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const SCALE = 0.7;

const COMPONENT_LIBRARY = [
  { type: 'HEADING', label: 'Heading', icon: 'H', category: 'Text' },
  { type: 'TEXT_BLOCK', label: 'Text Block', icon: 'Aa', category: 'Text' },
  { type: 'PARAGRAPH', label: 'Paragraph', icon: '¶', category: 'Text' },
  { type: 'DIVIDER', label: 'Divider', icon: '—', category: 'Layout' },
  { type: 'SPACER', label: 'Spacer', icon: '▢', category: 'Layout' },
  { type: 'SCHOOL_LOGO', label: 'School Logo', icon: '🏫', category: 'School' },
  { type: 'SCHOOL_NAME', label: 'School Name', icon: 'SCH', category: 'School' },
  { type: 'STUDENT_NAME', label: 'Student Name', icon: '👤', category: 'Student' },
  { type: 'STUDENT_PHOTO', label: 'Student Photo', icon: '📷', category: 'Student' },
  { type: 'STUDENT_INFO', label: 'Student Info', icon: '📋', category: 'Student' },
  { type: 'CLASS_NAME', label: 'Class Name', icon: '📚', category: 'Academic' },
  { type: 'TERM_INFO', label: 'Term Info', icon: '📅', category: 'Academic' },
  { type: 'RESULTS_TABLE', label: 'Results Table', icon: '📊', category: 'Data' },
  { type: 'GRADE_TABLE', label: 'Grade Table', icon: '📈', category: 'Data' },
  { type: 'ATTENDANCE_TABLE', label: 'Attendance', icon: '✅', category: 'Data' },
  { type: 'RANKING_TABLE', label: 'Rankings', icon: '🏆', category: 'Data' },
  { type: 'PERFORMANCE_CHART', label: 'Bar Chart', icon: '📊', category: 'Charts' },
  { type: 'RADAR_CHART', label: 'Radar Chart', icon: '🕸', category: 'Charts' },
  { type: 'LINE_CHART', label: 'Line Chart', icon: '📉', category: 'Charts' },
  { type: 'ANALYTICS_SUMMARY', label: 'Summary', icon: '📊', category: 'Analytics' },
  { type: 'TEACHER_REMARKS', label: 'Remarks', icon: '💬', category: 'Remarks' },
  { type: 'SIGNATURE', label: 'Signature', icon: '✍', category: 'Official' },
  { type: 'STAMP', label: 'Stamp', icon: '🔏', category: 'Official' },
  { type: 'HEADER', label: 'Header', icon: '⏫', category: 'Layout' },
  { type: 'FOOTER', label: 'Footer', icon: '⏬', category: 'Layout' },
  { type: 'PAGE_NUMBER', label: 'Page #', icon: '#', category: 'Layout' },
  { type: 'WATERMARK', label: 'Watermark', icon: '💧', category: 'Layout' },
  { type: 'IMAGE', label: 'Image', icon: '🖼', category: 'Media' },
  { type: 'CUSTOM_TEXT', label: 'Custom Text', icon: '✏', category: 'Text' },
  { type: 'TABLE', label: 'Table', icon: '⊞', category: 'Data' },
];

const COMPONENT_PREVIEWS: Record<string, (props: any) => string> = {
  HEADING: (p) => `<h2 style="margin:0;font-size:${p.fontSize||18}px;color:${p.color||'#333'}">${p.text||'Heading'}</h2>`,
  TEXT_BLOCK: (p) => `<div style="font-size:${p.fontSize||12}px;color:${p.color||'#555'}">${p.text||'Text block content'}</div>`,
  PARAGRAPH: (p) => `<p style="margin:0;font-size:${p.fontSize||11}px;color:${p.color||'#666'};line-height:1.5">${p.text||'Paragraph text goes here...'}</p>`,
  DIVIDER: () => `<hr style="border:none;border-top:1px solid #ddd;margin:0"/>`,
  SPACER: () => `<div style="height:20px"></div>`,
  SCHOOL_LOGO: () => `<div style="width:60px;height:60px;background:#e8ddd0;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:24px;">🏫</div>`,
  SCHOOL_NAME: () => `<div style="font-size:16px;font-weight:bold;color:#1a365d;">School Name</div>`,
  STUDENT_NAME: () => `<div style="font-size:14px;font-weight:bold;color:#333;">Student Name</div>`,
  STUDENT_PHOTO: () => `<div style="width:50px;height:50px;border-radius:50%;background:#e8ddd0;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:20px;">👤</div>`,
  STUDENT_INFO: () => `<div style="font-size:10px;color:#666;"><strong>Name:</strong> John Doe<br/><strong>Adm:</strong> 2024-001</div>`,
  CLASS_NAME: () => `<div style="font-size:12px;color:#555;">Grade 10A</div>`,
  TERM_INFO: () => `<div style="font-size:11px;color:#777;">Term 1 - 2024</div>`,
  RESULTS_TABLE: () => `<table style="width:100%;border-collapse:collapse;font-size:9px;"><tr style="background:#1a365d;color:white;"><th style="padding:3px 5px;border:1px solid #1a365d;">Subject</th><th style="padding:3px 5px;border:1px solid #1a365d;">Score</th><th style="padding:3px 5px;border:1px solid #1a365d;">Grade</th></tr><tr><td style="padding:3px 5px;border:1px solid #eee;">Math</td><td style="padding:3px 5px;border:1px solid #eee;text-align:center;">85</td><td style="padding:3px 5px;border:1px solid #eee;text-align:center;">A</td></tr></table>`,
  GRADE_TABLE: () => `<table style="width:100%;border-collapse:collapse;font-size:8px;"><tr style="background:#f3f4f6;"><th style="padding:2px 4px;border:1px solid #eee;">Grade</th><th style="padding:2px 4px;border:1px solid #eee;">Range</th></tr></table>`,
  RANKING_TABLE: () => `<div style="font-size:10px;color:#333;"><strong>Position:</strong> 3/35</div>`,
  ATTENDANCE_TABLE: () => `<div style="font-size:10px;color:#333;"><strong>Attendance:</strong> 95%</div>`,
  PERFORMANCE_CHART: () => `<div style="width:100%;height:100%;min-height:40px;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:4px;opacity:0.7;"></div>`,
  RADAR_CHART: () => `<svg width="60" height="60" viewBox="0 0 60 60"><polygon points="30,5 48,22 42,45 18,45 12,22" fill="#3b82f633" stroke="#3b82f6" stroke-width="1.5"/></svg>`,
  LINE_CHART: () => `<svg width="80" height="40" viewBox="0 0 80 40"><polyline points="5,30 20,25 35,18 50,22 65,10 75,15" fill="none" stroke="#3b82f6" stroke-width="1.5"/></svg>`,
  ANALYTICS_SUMMARY: () => `<div style="display:flex;gap:4px;"><div style="flex:1;background:#eff6ff;padding:4px;border-radius:3px;text-align:center;"><div style="font-size:12px;font-weight:bold;color:#2563eb;">315</div><div style="font-size:7px;color:#666;">Total</div></div></div>`,
  TEACHER_REMARKS: (p) => `<div style="font-size:10px;color:#555;font-style:italic;">"${p.text||'A dedicated student.'}"</div>`,
  HEADER: (p) => `<div style="border-bottom:2px solid ${p.color||'#1976d2'};padding-bottom:4px;font-size:10px;color:#666;">${p.text||'School Report'}</div>`,
  FOOTER: (p) => `<div style="border-top:1px solid #ddd;padding-top:3px;font-size:8px;color:#999;">${p.text||'Page 1'}</div>`,
  PAGE_NUMBER: () => `<span style="font-size:9px;color:#999;">1</span>`,
  WATERMARK: (p) => `<div style="font-size:30px;color:${p.color||'#ddd'};opacity:0.15;transform:rotate(-25deg);">${p.text||'SAMPLE'}</div>`,
  IMAGE: () => `<div style="width:100%;height:100%;min-height:40px;background:#f3f4f6;border:1px dashed #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;">+ Image</div>`,
  CUSTOM_TEXT: (p) => `<div style="font-size:${p.fontSize||12}px;color:${p.color||'#333'}">${p.text||'Custom text'}</div>`,
  TABLE: () => `<div style="font-size:9px;color:#999;text-align:center;padding:8px;border:1px dashed #ddd;border-radius:4px;">Table</div>`,
  SIGNATURE: () => `<div style="border-top:1px solid #333;width:100px;padding-top:3px;font-size:8px;color:#666;">Signature</div>`,
  STAMP: () => `<div style="width:50px;height:50px;border-radius:50%;border:2px solid #dc2626;display:flex;align-items:center;justify-content:center;color:#dc2626;font-size:8px;font-weight:bold;">STAMP</div>`,
};

function RndComponent({ comp, onUpdate, onSelect, isSelected, onDelete }: {
  comp: any; onUpdate: (id: string, data: any) => void; onSelect: (c: any) => void; isSelected: boolean; onDelete: (id: string) => void;
}) {
  const preview = COMPONENT_PREVIEWS[comp.type];
  const props = comp.content || {};
  const content = preview ? preview(props) : `<div style="color:#999;font-size:10px;">${comp.type}</div>`;
  const bgColor = comp.styles?.bgColor || 'transparent';

  return (
    <Rnd
      default={{ x: comp.position?.x || 20, y: comp.position?.y || 20, width: comp.size?.width || 200, height: comp.size?.height || 40 }}
      onDragStop={(e, d) => onUpdate(comp.id, { position: { x: d.x, y: d.y } })}
      onResizeStop={(e, dir, ref, delta, position) => onUpdate(comp.id, { size: { width: ref.offsetWidth, height: ref.offsetHeight }, position })}
      onClick={() => onSelect(comp)}
      bounds="parent"
      enableResizing={{ top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true }}
      minWidth={30}
      minHeight={20}
      className={`group absolute ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:ring-1 hover:ring-blue-300'}`}
      style={{ background: bgColor, borderRadius: '2px', cursor: 'move' }}
    >
      <div className="w-full h-full overflow-hidden" dangerouslySetInnerHTML={{ __html: content }} />
      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(comp.id); }}
          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center hover:bg-red-600 z-50">✕</button>
      )}
      <div className="absolute -top-4 left-0 bg-blue-500 text-white text-[7px] px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">{comp.label}</div>
    </Rnd>
  );
}

export default function TemplateBuilderPage() {
  const queryClient = useQueryClient();
  const pageRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [template, setTemplate] = useState<any>(null);
  const [components, setComponents] = useState<any[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [showLibrary, setShowLibrary] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: templatesData } = useQuery({
    queryKey: ['template-builder-templates'],
    queryFn: async () => (await api.get('/template-builder')).data || [],
  });

  useEffect(() => {
    if (templatesData && Array.isArray(templatesData)) setTemplates(templatesData);
  }, [templatesData]);

  useEffect(() => {
    if (selectedId) loadTemplate(selectedId);
  }, [selectedId]);

  const loadTemplate = async (id: string) => {
    const res = await api.get(`/template-builder/${id}`);
    setTemplate(res.data);
    setComponents(res.data?.components || []);
    setSelectedComponent(null);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/template-builder', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['template-builder-templates'] });
      setSelectedId(res.data?.id || res.data?.data?.id);
      setShowNewForm(false);
    },
  });

  const handleUpdateComponent = async (cid: string, data: any) => {
    try {
      await api.patch(`/template-builder/${selectedId}/components/${cid}`, data);
      setComponents(prev => prev.map(c => c.id === cid ? { ...c, ...data } : c));
    } catch {}
  };

  const handleAddComponent = async (type: string) => {
    if (!selectedId) return;
    const def = COMPONENT_LIBRARY.find(c => c.type === type);
    try {
      const res = await api.post(`/template-builder/${selectedId}/components`, {
        type, label: def?.label || type, content: { text: '' }, styles: {}, position: { x: 20 + Math.random() * 50, y: 20 + Math.random() * 50 }, size: { width: 200, height: 40 },
      });
      loadTemplate(selectedId);
    } catch {}
  };

  const handleDeleteComponent = async (cid: string) => {
    if (!selectedId) return;
    try {
      await api.delete(`/template-builder/${selectedId}/components/${cid}`);
      setComponents(prev => prev.filter(c => c.id !== cid));
      if (selectedComponent?.id === cid) setSelectedComponent(null);
    } catch {}
  };

  const handleExportPdf = async () => {
    if (!selectedId) return;
    try {
      const res = await api.post(`/template-builder/${selectedId}/pdf`, {}, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template?.name || 'report'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setMessage({ type: 'error', text: 'PDF generation failed' }); }
  };

  const groupedLibrary = COMPONENT_LIBRARY.reduce((acc: any, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {message && (
        <div className={`px-4 py-2 text-sm flex justify-between items-center ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span>{message.text}</span><button onClick={() => setMessage(null)} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Template Builder</h1>
          {template && <><span className="text-xs text-gray-500">/ {template.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${template.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{template.status}</span></>}
        </div>
        <div className="flex items-center gap-2">
          {!selectedId ? (
            <button onClick={() => setShowNewForm(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">+ New Template</button>
          ) : (
            <>
              <button onClick={handleExportPdf} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">PDF</button>
              <button onClick={() => api.post(`/template-builder/${selectedId}/publish`).then(() => loadTemplate(selectedId))} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Publish</button>
              <button onClick={() => { setSelectedId(null); setTemplate(null); setComponents([]); }} className="px-3 py-1.5 text-gray-600 text-xs hover:bg-gray-100 rounded-lg">← Back</button>
            </>
          )}
        </div>
      </div>

      {!selectedId ? (
        <div className="flex-1 overflow-y-auto p-6">
          {showNewForm && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4 max-w-md">
              <div className="flex gap-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                <button onClick={() => { if (newName) createMutation.mutate({ name: newName }); }} disabled={!newName} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">Create</button>
                <button onClick={() => setShowNewForm(false)} className="px-4 py-2 border border-gray-300 text-xs rounded-lg">Cancel</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {templates.map((t: any) => (
              <div key={t.id} onClick={() => setSelectedId(t.id)} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wider">{t.templateType?.replace(/_/g, ' ') || 'REPORT'}</span>
                  {t.isDefault && <span className="text-[8px] bg-green-100 text-green-700 px-1 rounded">Default</span>}
                </div>
                <h3 className="text-sm font-semibold mt-1">{t.name}</h3>
                <div className="text-[10px] text-gray-400 mt-1">v{t.version}, {t._count?.components || 0} items</div>
                <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); api.post(`/template-builder/${t.id}/duplicate`).then(() => queryClient.invalidateQueries({ queryKey: ['template-builder-templates'] })); }} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200">Dup</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) api.delete(`/template-builder/${t.id}`).then(() => queryClient.invalidateQueries({ queryKey: ['template-builder-templates'] })); }} className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className={`${showLibrary ? 'w-48' : 'w-0'} transition-all bg-white border-r border-gray-200 overflow-y-auto shrink-0`}>
            {showLibrary && (
              <div className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Components</h3>
                  <button onClick={() => setShowLibrary(false)} className="text-gray-300 hover:text-gray-500 text-[10px]">✕</button>
                </div>
                {Object.entries(groupedLibrary).map(([cat, comps]: [string, any]) => (
                  <div key={cat} className="mb-3">
                    <h4 className="text-[8px] font-medium text-gray-300 uppercase mb-1 tracking-wider">{cat}</h4>
                    <div className="grid grid-cols-2 gap-1">
                      {comps.map((c: any) => (
                        <button key={c.type} onClick={() => handleAddComponent(c.type)}
                          className="flex flex-col items-center p-1.5 border border-dashed border-gray-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-all">
                          <span className="text-sm">{c.icon}</span>
                          <span className="text-[7px] text-gray-400 text-center leading-tight mt-0.5">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 bg-gray-200 overflow-auto flex items-start justify-center p-4">
            <div ref={pageRef} className="bg-white shadow-xl relative" style={{ width: PAGE_WIDTH, minHeight: PAGE_HEIGHT, transform: `scale(${SCALE})`, transformOrigin: 'top center' }}>
              {components.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm pointer-events-none">
                  {showLibrary ? 'Drag components from the library' : 'Click + to add components'}
                </div>
              )}
              {components.map((comp: any) => (
                <RndComponent key={comp.id} comp={comp} onUpdate={handleUpdateComponent} onSelect={setSelectedComponent} isSelected={selectedComponent?.id === comp.id} onDelete={handleDeleteComponent} />
              ))}
            </div>
          </div>

          <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
            {!showLibrary && (
              <div className="p-2 border-b border-gray-100">
                <button onClick={() => setShowLibrary(true)} className="w-full px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700">+ Add Component</button>
              </div>
            )}

            <div className="p-2 border-b border-gray-100">
              <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Page</h3>
              <div className="space-y-1">
                <select value={template?.pageSize || 'A4'} onChange={(e) => api.patch(`/template-builder/${selectedId}`, { pageSize: e.target.value })}
                  className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]">
                  <option value="A4">A4</option><option value="LETTER">Letter</option><option value="LEGAL">Legal</option>
                </select>
                <select value={template?.orientation || 'portrait'} onChange={(e) => api.patch(`/template-builder/${selectedId}`, { orientation: e.target.value })}
                  className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]">
                  <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
                </select>
              </div>
            </div>

            {selectedComponent && (
              <div className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Element</h3>
                  <span className="text-[8px] text-gray-300">{selectedComponent.type}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[7px] text-gray-400">X</label>
                      <input type="number" value={Math.round(selectedComponent.position?.x || 0)}
                        onChange={(e) => handleUpdateComponent(selectedComponent.id, { position: { ...selectedComponent.position, x: parseInt(e.target.value) || 0 } })}
                        className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px]" />
                    </div>
                    <div>
                      <label className="text-[7px] text-gray-400">Y</label>
                      <input type="number" value={Math.round(selectedComponent.position?.y || 0)}
                        onChange={(e) => handleUpdateComponent(selectedComponent.id, { position: { ...selectedComponent.position, y: parseInt(e.target.value) || 0 } })}
                        className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className="text-[7px] text-gray-400">W</label>
                      <input type="number" value={Math.round(selectedComponent.size?.width || 100)}
                        onChange={(e) => handleUpdateComponent(selectedComponent.id, { size: { ...selectedComponent.size, width: parseInt(e.target.value) || 100 } })}
                        className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px]" />
                    </div>
                    <div>
                      <label className="text-[7px] text-gray-400">H</label>
                      <input type="number" value={Math.round(selectedComponent.size?.height || 30)}
                        onChange={(e) => handleUpdateComponent(selectedComponent.id, { size: { ...selectedComponent.size, height: parseInt(e.target.value) || 30 } })}
                        className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[7px] text-gray-400">Font Size</label>
                    <input type="number" value={selectedComponent.content?.fontSize || 12}
                      onChange={(e) => handleUpdateComponent(selectedComponent.id, { content: { ...selectedComponent.content, fontSize: parseInt(e.target.value) || 12 } })}
                      className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px]" />
                  </div>
                  <div>
                    <label className="text-[7px] text-gray-400">Color</label>
                    <div className="flex items-center gap-1">
                      <input type="color" value={selectedComponent.content?.color || selectedComponent.styles?.color || '#333333'}
                        onChange={(e) => {
                          const content = { ...selectedComponent.content, color: e.target.value };
                          handleUpdateComponent(selectedComponent.id, { content, styles: { ...selectedComponent.styles, color: e.target.value } });
                        }}
                        className="w-7 h-6 border border-gray-200 rounded cursor-pointer" />
                      <span className="text-[8px] text-gray-400 font-mono">{selectedComponent.content?.color || selectedComponent.styles?.color || '#333'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[7px] text-gray-400">Background</label>
                    <input type="color" value={selectedComponent.styles?.bgColor || '#ffffff'}
                      onChange={(e) => handleUpdateComponent(selectedComponent.id, { styles: { ...selectedComponent.styles, bgColor: e.target.value } })}
                      className="w-full h-6 border border-gray-200 rounded cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-[7px] text-gray-400">Text</label>
                    <textarea value={selectedComponent.content?.text || ''} rows={2}
                      onChange={(e) => handleUpdateComponent(selectedComponent.id, { content: { ...selectedComponent.content, text: e.target.value } })}
                      className="w-full px-1 py-0.5 border border-gray-200 rounded text-[10px]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
