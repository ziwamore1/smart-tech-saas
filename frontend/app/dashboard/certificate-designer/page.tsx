'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as fabric from 'fabric';
import { api } from '@/lib/api';

const certApi = {
  getAll: () => api.get('/template-builder', { params: { type: 'CERTIFICATE' } }),
  get: (id: string) => api.get(`/template-builder/${id}`),
  create: (data: any) => api.post('/template-builder', data),
  update: (id: string, data: any) => api.patch(`/template-builder/${id}`, data),
  delete: (id: string) => api.delete(`/template-builder/${id}`),
  duplicate: (id: string) => api.post(`/template-builder/${id}/duplicate`),
  publish: (id: string) => api.post(`/template-builder/${id}/publish`),
  getCertSettings: (id: string) => api.get(`/template-builder/${id}/certificate`),
  updateCert: (id: string, data: any) => api.patch(`/template-builder/${id}/certificate`, data),
  renderCert: (id: string, data: any) => api.post(`/template-builder/${id}/certificate/render`, data),
  getPdf: (id: string, data?: any) => api.post(`/template-builder/${id}/certificate/pdf`, data || {}, { responseType: 'blob' }),
  getQr: (id: string, data: string) => api.post(`/template-builder/${id}/certificate/qr`, { data }),
};

const BORDER_STYLES = [
  { value: 'classic', label: 'Classic Double', icon: '⊞' },
  { value: 'modern', label: 'Modern Solid', icon: '▬' },
  { value: 'elegant', label: 'Elegant Shadow', icon: '▣' },
  { value: 'ornate', label: 'Ornate Frame', icon: '☩' },
  { value: 'minimal', label: 'Minimal', icon: '□' },
  { value: 'gold', label: 'Gold Premium', icon: '✦' },
];

const CERT_TYPES = [
  { value: 'ACADEMIC_EXCELLENCE', label: 'Academic Excellence', icon: '🎓' },
  { value: 'PARTICIPATION', label: 'Participation', icon: '🤝' },
  { value: 'GRADUATION', label: 'Graduation', icon: '🎉' },
  { value: 'ATTENDANCE', label: 'Attendance', icon: '✅' },
  { value: 'MERIT_AWARD', label: 'Merit Award', icon: '⭐' },
  { value: 'SPORTS_AWARD', label: 'Sports Award', icon: '🏅' },
  { value: 'LEADERSHIP_AWARD', label: 'Leadership Award', icon: '👑' },
];

export default function CertificateDesignerPage() {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [template, setTemplate] = useState<any>(null);
  const [cert, setCert] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'preview'>('design');
  const [selectedObject, setSelectedObject] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { data: templatesData } = useQuery({
    queryKey: ['cert-templates'],
    queryFn: async () => (await certApi.getAll()).data || [],
  });

  useEffect(() => {
    if (templatesData && Array.isArray(templatesData)) setTemplates(templatesData);
  }, [templatesData]);

  useEffect(() => {
    if (selectedId) loadCert(selectedId);
  }, [selectedId]);

  const loadCert = async (id: string) => {
    try {
      const [tRes, cRes] = await Promise.all([certApi.get(id), certApi.getCertSettings(id)]);
      setTemplate(tRes.data);
      setCert(cRes.data);
      setPreviewHtml(null);
      setActiveTab('design');
    } catch { setMessage({ type: 'error', text: 'Failed to load certificate' }); }
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => certApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cert-templates'] });
      setSelectedId(res.data?.id || res.data?.data?.id);
      setShowNewForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => certApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cert-templates'] }),
  });

  const updateCertMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => certApi.updateCert(id, data),
    onSuccess: () => { if (selectedId) certApi.getCertSettings(selectedId).then(r => setCert(r.data)); },
  });

  const initCanvas = useCallback(() => {
    if (!canvasRef.current || fabricRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 750,
      height: 530,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    });

    canvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on('selection:updated', (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on('selection:cleared', () => setSelectedObject(null));
    canvas.on('object:modified', () => canvas.renderAll());

    // Add default elements
    addDefaultElements(canvas);
    fabricRef.current = canvas;
  }, []);

  const addDefaultElements = (canvas: fabric.Canvas) => {
    const schoolText = new fabric.Textbox('School Name', {
      left: 150, top: 60, width: 450, fontSize: 26, fontWeight: 'bold',
      fill: '#1a365d', fontFamily: 'Georgia', textAlign: 'center', name: 'schoolName',
    });
    const titleText = new fabric.Textbox('Certificate of Achievement', {
      left: 200, top: 105, width: 350, fontSize: 11, fill: '#888',
      fontFamily: 'Arial', textAlign: 'center', charSpacing: 400, name: 'certTitle',
    });
    const awardText = new fabric.Textbox('This certificate is awarded to', {
      left: 200, top: 160, width: 350, fontSize: 14, fill: '#666',
      fontFamily: 'Georgia', textAlign: 'center', name: 'awardText',
    });
    const studentText = new fabric.Textbox('Student Name', {
      left: 150, top: 190, width: 450, fontSize: 32, fontWeight: 'bold',
      fill: '#1a365d', fontFamily: 'Georgia', textAlign: 'center', name: 'studentName',
    });
    const detailText = new fabric.Textbox('Class: Grade 10A | Term 1 - 2024', {
      left: 200, top: 245, width: 350, fontSize: 12, fill: '#777',
      fontFamily: 'Arial', textAlign: 'center', name: 'details',
    });
    const sig1Text = new fabric.Textbox('Head Teacher', {
      left: 120, top: 430, width: 200, fontSize: 10, fill: '#888',
      fontFamily: 'Arial', textAlign: 'center', name: 'signature1',
    });
    const sig2Text = new fabric.Textbox('Director', {
      left: 430, top: 430, width: 200, fontSize: 10, fill: '#888',
      fontFamily: 'Arial', textAlign: 'center', name: 'signature2',
    });
    const sigLine1 = new fabric.Line([120, 425, 320, 425], {
      stroke: '#555', strokeWidth: 1, name: 'sigLine1',
    });
    const sigLine2 = new fabric.Line([430, 425, 630, 425], {
      stroke: '#555', strokeWidth: 1, name: 'sigLine2',
    });
    const certNum = new fabric.Textbox('Certificate No: XXXXXX', {
      left: 280, top: 480, width: 200, fontSize: 9, fill: '#aaa',
      fontFamily: 'Arial', textAlign: 'center', name: 'certNumber',
    });

    canvas.add(schoolText, titleText, awardText, studentText, detailText);
    canvas.add(sigLine1, sigLine2, sig1Text, sig2Text, certNum);
    canvas.renderAll();
  };

  useEffect(() => {
    if (activeTab === 'design') {
      setTimeout(initCanvas, 100);
    }
    return () => { fabricRef.current?.dispose(); fabricRef.current = null; };
  }, [activeTab, initCanvas]);

  const addTextElement = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const text = new fabric.Textbox('Double click to edit', {
      left: 100 + Math.random() * 100, top: 100 + Math.random() * 100,
      width: 200, fontSize: 16, fill: '#333', fontFamily: 'Georgia',
      name: `text_${Date.now()}`,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  const addImageElement = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const url = ev.target?.result as string;
        const img = await fabric.Image.fromURL(url, { crossOrigin: 'anonymous' } as any);
        const canvas = fabricRef.current;
        if (!canvas) return;
        img.set({ left: 50, top: 50, scaleX: 0.3, scaleY: 0.3, name: `img_${Date.now()}` });
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const deleteSelected = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (active) {
      canvas.remove(active);
      canvas.discardActiveObject();
      canvas.renderAll();
      setSelectedObject(null);
    }
  };

  const exportCanvas = () => {
    const canvas = fabricRef.current;
    if (!canvas || !selectedId) return;
    const json = JSON.stringify(canvas.toJSON(['name']));
    certApi.update(selectedId, { layoutJson: JSON.parse(json) });
    setMessage({ type: 'success', text: 'Layout saved' });
  };

  const handlePreview = async () => {
    if (!selectedId) return;
    try {
      const res = await certApi.renderCert(selectedId, {
        studentName: 'John Doe',
        className: 'Grade 10A',
        termName: 'Term 1',
        academicYear: '2024',
      });
      setPreviewHtml(res.data?.html || '');
      setActiveTab('preview');
    } catch { setMessage({ type: 'error', text: 'Preview failed' }); }
  };

  const handleExportPdf = async () => {
    if (!selectedId) return;
    try {
      const res = await certApi.getPdf(selectedId, {
        studentName: 'John Doe',
        className: 'Grade 10A',
        termName: 'Term 1',
        academicYear: '2024',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template?.name || 'certificate'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { setMessage({ type: 'error', text: 'PDF generation failed' }); }
  };

  const selectedObjProps = selectedObject ? {
    left: Math.round(selectedObject.left || 0),
    top: Math.round(selectedObject.top || 0),
    width: Math.round(selectedObject.width || 0) * (selectedObject.scaleX || 1),
    height: Math.round(selectedObject.height || 0) * (selectedObject.scaleY || 1),
    fontSize: selectedObject.fontSize || null,
    fill: selectedObject.fill || '#333333',
    fontFamily: selectedObject.fontFamily || 'Georgia',
    textAlign: selectedObject.textAlign || 'left',
    opacity: selectedObject.opacity ?? 1,
  } : null;

  const updateSelectedProp = (prop: string, value: any) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    (obj as any).set(prop, value);
    if (prop === 'fontSize' || prop === 'fill' || prop === 'fontFamily' || prop === 'textAlign') {
      canvas?.renderAll();
    }
    canvas?.renderAll();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {message && (
        <div className={`px-4 py-2 text-sm flex justify-between items-center ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-2 font-bold">&times;</button>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Certificate Designer</h1>
            {template && <><span className="text-xs text-gray-500">/ {template.name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${template.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{template.status}</span></>}
          </div>
          <div className="flex items-center gap-2">
            {!selectedId ? (
              <button onClick={() => setShowNewForm(true)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">+ New Certificate</button>
            ) : (
              <>
                <button onClick={exportCanvas} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Save Layout</button>
                <button onClick={handlePreview} className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700">Preview</button>
                <button onClick={handleExportPdf} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">PDF</button>
                <button onClick={() => certApi.publish(selectedId).then(() => loadCert(selectedId))} className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Publish</button>
                <button onClick={() => { setSelectedId(null); setTemplate(null); setCert(null); }} className="px-3 py-1.5 text-gray-600 text-xs hover:bg-gray-100 rounded-lg">← Back</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 overflow-y-auto p-6">
            {showNewForm && (
              <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4 max-w-md">
                <h2 className="text-sm font-semibold mb-3">New Certificate Template</h2>
                <div className="flex gap-2">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Certificate name" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs" />
                  <button onClick={() => { if (newName) createMutation.mutate({ name: newName, templateType: 'CERTIFICATE' }); }} disabled={!newName} className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg disabled:opacity-50">Create</button>
                  <button onClick={() => setShowNewForm(false)} className="px-4 py-2 border border-gray-300 text-xs rounded-lg">Cancel</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((t: any) => (
                <div key={t.id} onClick={() => setSelectedId(t.id)} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group">
                  <div className="text-2xl mb-2">{CERT_TYPES.find(ct => ct.value === t.templateType)?.icon || '📜'}</div>
                  <h3 className="text-sm font-semibold text-gray-800">{t.name}</h3>
                  <div className="text-[10px] text-gray-400 mt-1">{t._count?.components || 0} elements</div>
                  <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={(e) => { e.stopPropagation(); certApi.duplicate(t.id).then(() => queryClient.invalidateQueries({ queryKey: ['cert-templates'] })); }} className="text-[10px] px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200">Duplicate</button>
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) certApi.delete(t.id).then(() => queryClient.invalidateQueries({ queryKey: ['cert-templates'] })); }} className="text-[10px] px-2 py-0.5 bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && !showNewForm && (
                <div className="col-span-full text-center py-16 text-gray-400">
                  <div className="text-4xl mb-3">📜</div>
                  <p className="text-sm">No certificate templates yet</p>
                  <button onClick={() => setShowNewForm(true)} className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs rounded-lg">Create One</button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          <div className="flex-1 bg-gray-100 overflow-hidden relative">
            {previewHtml ? (
              <iframe srcDoc={previewHtml} className="w-full h-full border-0" title="Certificate Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">Click Preview to render</div>
            )}
            <button onClick={() => setActiveTab('design')} className="absolute top-3 left-3 px-3 py-1.5 bg-white border border-gray-200 text-xs rounded-lg shadow hover:bg-gray-50">← Back to Design</button>
          </div>
        ) : (
          <>
            <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-2 gap-2 shrink-0">
              <button onClick={addTextElement} className="p-2 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-xs" title="Add Text">T</button>
              <button onClick={addImageElement} className="p-2 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-xs" title="Add Image">🖼</button>
              <button onClick={deleteSelected} className="p-2 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 text-xs" title="Delete">✕</button>
              <div className="border-t border-gray-200 my-1 w-6"></div>
              <button onClick={() => { fabricRef.current?.renderAll(); }} className="p-2 rounded hover:bg-blue-50 text-gray-500 hover:text-blue-600 text-xs" title="Refresh">↻</button>
            </div>

            <div className="flex-1 flex items-center justify-center bg-gray-100 overflow-auto p-4">
              <div className="bg-white shadow-lg" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                <canvas ref={canvasRef} width={750} height={530} />
              </div>
            </div>

            <div className="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0">
              <div className="p-3 border-b border-gray-100">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Certificate Type</h3>
                <div className="grid grid-cols-2 gap-1">
                  {CERT_TYPES.map(ct => (
                    <button key={ct.value} onClick={() => updateCertMutation.mutate({ id: selectedId, data: { certificateType: ct.value } })}
                      className={`flex items-center gap-1 p-1.5 rounded text-[9px] border ${cert?.certificateType === ct.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <span>{ct.icon}</span>
                      <span className="truncate">{ct.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 border-b border-gray-100">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Border</h3>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {BORDER_STYLES.map(b => (
                    <button key={b.value} onClick={() => updateCertMutation.mutate({ id: selectedId, data: { borderStyle: b.value } })}
                      className={`p-1.5 rounded text-xs border ${cert?.borderStyle === b.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      title={b.label}>{b.icon}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[9px] text-gray-400">Color</label>
                  <input type="color" value={cert?.borderColor || '#1a365d'}
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { borderColor: e.target.value } })}
                    className="w-8 h-7 border border-gray-200 rounded cursor-pointer" />
                </div>
              </div>

              <div className="p-3 border-b border-gray-100">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Content</h3>
                <div className="space-y-1.5">
                  <input type="text" value={cert?.awardText || 'This certificate is awarded to'} placeholder="Award text"
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { awardText: e.target.value } })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px]" />
                  <input type="text" value={cert?.signature1Label || 'Head Teacher'} placeholder="Sig 1 label"
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { signature1Label: e.target.value } })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px]" />
                  <input type="text" value={cert?.signature1Name || ''} placeholder="Sig 1 name"
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { signature1Name: e.target.value } })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px]" />
                  <input type="text" value={cert?.signature2Label || ''} placeholder="Sig 2 label"
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { signature2Label: e.target.value } })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px]" />
                  <input type="text" value={cert?.signature2Name || ''} placeholder="Sig 2 name"
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { signature2Name: e.target.value } })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px]" />
                </div>
              </div>

              <div className="p-3 border-b border-gray-100">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Features</h3>
                {[
                  { key: 'showQrCode', label: 'QR Code' },
                  { key: 'autoNumbering', label: 'Auto Numbering' },
                  { key: 'showPhoto', label: 'Student Photo' },
                  { key: 'showBadge', label: 'Achievement Badge' },
                  { key: 'showWatermark', label: 'Watermark' },
                ].map(f => (
                  <label key={f.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input type="checkbox" checked={cert?.[f.key] ?? (['showQrCode', 'autoNumbering', 'showPhoto', 'showBadge'].includes(f.key))}
                      onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { [f.key]: e.target.checked } })}
                      className="rounded border-gray-300 w-3 h-3" />
                    <span className="text-[10px] text-gray-600">{f.label}</span>
                  </label>
                ))}
                {cert?.showWatermark && (
                  <input type="text" value={cert?.watermarkText || ''} placeholder="Watermark text"
                    onChange={(e) => updateCertMutation.mutate({ id: selectedId, data: { watermarkText: e.target.value } })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-[10px] mt-1" />
                )}
              </div>

              {selectedObjProps && (
                <div className="p-3">
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Selected Element</h3>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[8px] text-gray-400">X</label>
                        <input type="number" value={selectedObjProps.left} onChange={(e) => updateSelectedProp('left', parseInt(e.target.value))}
                          className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]" />
                      </div>
                      <div>
                        <label className="text-[8px] text-gray-400">Y</label>
                        <input type="number" value={selectedObjProps.top} onChange={(e) => updateSelectedProp('top', parseInt(e.target.value))}
                          className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]" />
                      </div>
                    </div>
                    {selectedObjProps.fontSize && (
                      <div>
                        <label className="text-[8px] text-gray-400">Font Size</label>
                        <input type="number" value={selectedObjProps.fontSize} onChange={(e) => updateSelectedProp('fontSize', parseInt(e.target.value))}
                          className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]" />
                      </div>
                    )}
                    <div>
                      <label className="text-[8px] text-gray-400">Color</label>
                      <input type="color" value={selectedObjProps.fill} onChange={(e) => updateSelectedProp('fill', e.target.value)}
                        className="w-full h-6 border border-gray-200 rounded cursor-pointer" />
                    </div>
                    <div>
                      <label className="text-[8px] text-gray-400">Opacity</label>
                      <input type="range" min="0" max="1" step="0.1" value={selectedObjProps.opacity} onChange={(e) => updateSelectedProp('opacity', parseFloat(e.target.value))}
                        className="w-full" />
                    </div>
                    {selectedObjProps.fontFamily && (
                      <div>
                        <label className="text-[8px] text-gray-400">Font</label>
                        <select value={selectedObjProps.fontFamily} onChange={(e) => updateSelectedProp('fontFamily', e.target.value)}
                          className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]">
                          <option value="Georgia">Georgia</option>
                          <option value="Arial">Arial</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Helvetica">Helvetica</option>
                          <option value="Courier New">Courier New</option>
                        </select>
                      </div>
                    )}
                    {selectedObjProps.textAlign && (
                      <div>
                        <label className="text-[8px] text-gray-400">Align</label>
                        <select value={selectedObjProps.textAlign} onChange={(e) => updateSelectedProp('textAlign', e.target.value)}
                          className="w-full px-1.5 py-1 border border-gray-200 rounded text-[10px]">
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
