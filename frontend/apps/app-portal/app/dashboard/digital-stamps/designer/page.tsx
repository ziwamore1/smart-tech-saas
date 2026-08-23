'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stampEngineApi } from '@/lib/api';

/**
 * Digital Stamp Designer — reproduces an institution's real physical stamp
 * as a configurable layer stack. Live preview is rendered by the SAME
 * server-side engine used on finalized documents (single source of truth).
 */

type ShapeType = 'circle' | 'rectangle' | 'square' | 'oval';

interface LayerDraft {
  id: string;
  type: 'curved-text' | 'text' | 'image' | 'date' | 'serial' | 'verification-marker';
  name: string;
  enabled: boolean;
  content?: string;
  x: number; y: number; rotation: number; opacity: number; zIndex: number;
  fontFamily: string; fontSize: number; fontWeight: string; letterSpacing: number; color: string;
  curveRadius?: number; startAngle?: number; endAngle?: number;
  assetId?: string; width?: number; height?: number;
  showTime?: boolean; label?: string;
}

interface TemplateRow {
  id: string; name: string; status: string; version: number; isDefault: boolean; updatedAt: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const defaultLayers = (): LayerDraft[] => ([
  { id: uid(), type: 'curved-text', name: 'Top arc — institution name', enabled: true, content: 'INSTITUTION NAME', x: 300, y: 120, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 40, fontWeight: 'bold', letterSpacing: 4, color: '#123456', curveRadius: 225, startAngle: -155, endAngle: -25 },
  { id: uid(), type: 'curved-text', name: 'Bottom arc — motto / office', enabled: true, content: 'OFFICIAL DOCUMENT', x: 300, y: 480, rotation: 0, opacity: 1, zIndex: 11, fontFamily: 'serif', fontSize: 30, fontWeight: 'bold', letterSpacing: 3, color: '#123456', curveRadius: 235, startAngle: 150, endAngle: 30 },
  { id: uid(), type: 'image', name: 'Center logo / emblem', enabled: false, x: 300, y: 255, rotation: 0, opacity: 1, zIndex: 20, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 130, height: 130 },
  { id: uid(), type: 'text', name: 'Department', enabled: true, content: 'DEPARTMENT OF EDUCATION', x: 300, y: 385, rotation: 0, opacity: 1, zIndex: 30, fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, color: '#1e3a5f' },
  { id: uid(), type: 'date', name: 'Stamp date (+ time)', enabled: true, label: 'DIGITALLY STAMPED', showTime: true, x: 300, y: 425, rotation: 0, opacity: 1, zIndex: 31, fontFamily: 'serif', fontSize: 14, fontWeight: 'bold', letterSpacing: 1, color: '#111827' },
  { id: uid(), type: 'serial', name: 'Serial number', enabled: true, label: '', x: 300, y: 458, rotation: 0, opacity: 1, zIndex: 32, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: '#374151' },
  { id: uid(), type: 'verification-marker', name: 'Verification check', enabled: false, x: 300, y: 520, rotation: 0, opacity: 1, zIndex: 33, fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#15803d', label: 'VERIFIED DIGITALLY', width: 34, height: 34 },
]);

export default function StampDesignerPage() {
  const [name, setName] = useState('Official School Stamp');
  const [shapeType, setShapeType] = useState<ShapeType>('circle');
  const [borderColor, setBorderColor] = useState('#123456');
  const [borderWidth, setBorderWidth] = useState(7);
  const [borderCount, setBorderCount] = useState(2);
  const [innerRing, setInnerRing] = useState(true);
  const [innerRingDashed, setInnerRingDashed] = useState(true);
  const [inkOpacity, setInkOpacity] = useState(0.92);
  const [texture, setTexture] = useState<'none' | 'ink' | 'grain'>('ink');
  const [watermarkText, setWatermarkText] = useState('');
  const [layers, setLayers] = useState<LayerDraft[]>(defaultLayers());
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [svg, setSvg] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [openVersions, setOpenVersions] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const debounceRef = useRef<any>(null);

  const notify = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  };

  const configJson = useMemo(() => ({
    canvas: { width: 600, height: 600, background: 'transparent' },
    shape: {
      type: shapeType,
      outerRadius: shapeType === 'circle' ? 280 : undefined,
      width: shapeType !== 'circle' ? 560 : undefined,
      height: shapeType !== 'circle' ? 560 : undefined,
      borderWidth, borderColor, borderCount,
      innerRings: innerRing
        ? [{ radius: shapeType === 'circle' ? 238 : undefined, inset: shapeType !== 'circle' ? 22 : undefined, width: 2, color: borderColor, dashed: innerRingDashed }]
        : [],
    },
    layers: layers
      .filter(l => l.enabled)
      .map(l => {
        if (l.type === 'curved-text') {
          return { id: l.id, type: l.type, name: l.name, content: l.content || '', x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, fontFamily: l.fontFamily, fontSize: l.fontSize, fontWeight: l.fontWeight, letterSpacing: l.letterSpacing, color: l.color,
            curve: { centerX: 300, centerY: 300, radius: l.curveRadius ?? 225, startAngle: l.startAngle ?? -150, endAngle: l.endAngle ?? -30, orientation: (l.startAngle ?? 0) > 90 ? 'inward' : 'outward' } };
        }
        if (l.type === 'image') {
          return { id: l.id, type: l.type, name: l.name, x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, assetId: l.assetId || undefined, width: l.width ?? 130, height: l.height ?? 130 };
        }
        if (l.type === 'verification-marker') {
          return { id: l.id, type: l.type, name: l.name, x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, text: l.label || undefined, size: 36, fontSize: l.fontSize };
        }
        return { id: l.id, type: l.type, name: l.name, content: l.content || '', x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, fontFamily: l.fontFamily, fontSize: l.fontSize, fontWeight: l.fontWeight, letterSpacing: l.letterSpacing, color: l.color, label: l.label || undefined, showTime: l.showTime };
      }),
    effects: { inkOpacity, texture, watermarkText: watermarkText || undefined, noiseAmount: 0.18 },
  }), [shapeType, borderWidth, borderColor, borderCount, innerRing, innerRingDashed, inkOpacity, texture, watermarkText, layers]);

  const assetIds = useMemo(() => layers.filter(l => l.enabled && l.type === 'image' && l.assetId).map(l => l.assetId as string), [layers]);

  // Debounced server-rendered live preview — same engine that stamps documents.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await stampEngineApi.renderPreview(configJson, assetIds);
        setSvg(res.data.svg);
      } catch {
        /* preview is best-effort */
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [configJson, assetIds]);

  const loadLists = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([stampEngineApi.listTemplates(), stampEngineApi.listAssets()]);
      setTemplates(t.data.templates || []);
      setAssets(a.data.assets || []);
    } catch { /* gated tiers */ }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  const updateLayer = (id: string, patch: Partial<LayerDraft>) =>
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));

  const handleUploadAsset = async (file: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const res = await stampEngineApi.uploadAsset(file, file.name.replace(/\.[^.]+$/, ''), 'LOGO');
      setAssets(prev => [res.data, ...prev]);
      notify('ok', 'Asset uploaded');
    } catch (e: any) {
      notify('err', e?.response?.data?.message || 'Upload failed');
    } finally { setBusy(false); }
  };

  const saveTemplate = async (publish: boolean) => {
    setBusy(true);
    try {
      let templateId: string | null = (templates.find(t => t.name === name && t.status === 'DRAFT') as any)?.id || null;
      if (templateId) {
        await stampEngineApi.updateTemplate(templateId, { configJson });
      } else {
        const res = await stampEngineApi.createTemplate({ name, configJson });
        templateId = res.data.id;
      }
      if (publish && templateId) {
        await stampEngineApi.publishTemplate(templateId, 'Published from designer');
      }
      await loadLists();
      notify('ok', publish ? 'Template published' : 'Draft saved');
    } catch (e: any) {
      notify('err', e?.response?.data?.message || e?.message || 'Save failed');
    } finally { setBusy(false); }
  };

  const selected = layers.find(l => l.id === selectedId) || null;

  const hydrateFromConfig = (tplName: string, cfg: any) => {
    if (!cfg || !Array.isArray(cfg.layers)) { notify('err', 'Template has no layer config'); return; }
    const shape = cfg.shape || {};
    const effects = cfg.effects || {};
    setName(tplName);
    setShapeType((shape.type || 'circle') as ShapeType);
    setBorderColor(shape.borderColor || '#123456');
    setBorderWidth(shape.borderWidth ?? 7);
    setBorderCount(shape.borderCount ?? 2);
    const ring = (shape.innerRings || [])[0];
    setInnerRing(Boolean(ring));
    setInnerRingDashed(Boolean(ring?.dashed));
    setInkOpacity(effects.inkOpacity ?? 0.92);
    setTexture((effects.texture || 'ink') as any);
    setWatermarkText(effects.watermarkText || '');
    setLayers(cfg.layers.map((l: any): LayerDraft => ({
      id: l.id || uid(), type: l.type, name: l.name || l.type, enabled: true,
      content: l.content, x: l.x ?? 300, y: l.y ?? 300, rotation: l.rotation ?? 0,
      opacity: l.opacity ?? 1, zIndex: l.zIndex ?? 10,
      fontFamily: l.fontFamily || 'serif', fontSize: l.fontSize ?? 14,
      fontWeight: l.fontWeight || 'normal', letterSpacing: l.letterSpacing ?? 0,
      color: l.color || '#123456',
      curveRadius: l.curve?.radius, startAngle: l.curve?.startAngle, endAngle: l.curve?.endAngle,
      assetId: l.assetId || '', width: l.width ?? 130, height: l.height ?? 130,
      showTime: l.showTime, label: l.label ?? l.text,
    })));
    setSelectedId(null);
    notify('ok', `Loaded "${tplName}" into the designer`);
  };

  const loadIntoDesigner = async (t: TemplateRow) => {
    try {
      const res = await stampEngineApi.getTemplate(t.id);
      hydrateFromConfig(t.name, res.data?.configJson);
    } catch (e: any) {
      notify('err', e?.response?.data?.message || 'Load failed');
    }
  };

  const duplicateTemplate = async (t: TemplateRow) => {
    setBusy(true);
    try {
      const res = await stampEngineApi.getTemplate(t.id);
      await stampEngineApi.createTemplate({ name: `${t.name} (Copy)`, configJson: res.data?.configJson });
      await loadLists();
      notify('ok', 'Duplicated as new draft');
    } catch (e: any) {
      notify('err', e?.response?.data?.message || 'Duplicate failed');
    } finally { setBusy(false); }
  };

  const toggleVersions = async (t: TemplateRow) => {
    if (openVersions === t.id) { setOpenVersions(null); return; }
    try {
      const res = await stampEngineApi.templateVersions(t.id);
      setVersions(res.data?.versions || []);
      setOpenVersions(t.id);
    } catch { notify('err', 'Could not load version history'); }
  };

  const rollbackTo = async (t: TemplateRow, v: number) => {
    setBusy(true);
    try {
      await stampEngineApi.rollbackTemplate(t.id, v);
      await loadLists();
      setOpenVersions(null);
      notify('ok', `Rolled back to v${v} as new draft`);
    } catch (e: any) {
      notify('err', e?.response?.data?.message || 'Rollback failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Stamp Designer</h1>
          <p className="text-sm text-gray-500">Reproduce your institution&apos;s official stamp. Preview uses the production rendering engine.</p>
        </div>
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => saveTemplate(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Save Draft</button>
          <button disabled={busy} onClick={() => saveTemplate(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">Publish</button>
        </div>
      </div>

      {toast && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${toast.kind === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>{toast.text}</div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* ── Controls ── */}
        <div className="col-span-4 space-y-4">
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Identity</h2>
            <label className="block text-xs font-medium text-gray-600">Template name
              <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-600">Shape
                <select value={shapeType} onChange={e => setShapeType(e.target.value as ShapeType)} className="mt-1 w-full border rounded-lg px-2 py-2 text-sm">
                  <option value="circle">Circle</option><option value="oval">Oval</option>
                  <option value="rectangle">Rectangle</option><option value="square">Square</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-600">Ink opacity
                <input type="range" min={0.3} max={1} step={0.02} value={inkOpacity} onChange={e => setInkOpacity(parseFloat(e.target.value))} className="mt-2 w-full" />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-xs font-medium text-gray-600">Border
                <input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="mt-1 w-full h-9 rounded cursor-pointer" />
              </label>
              <label className="block text-xs font-medium text-gray-600">Thickness
                <input type="number" min={1} max={16} value={borderWidth} onChange={e => setBorderWidth(parseInt(e.target.value) || 1)} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
              </label>
              <label className="block text-xs font-medium text-gray-600">Borders
                <input type="number" min={1} max={4} value={borderCount} onChange={e => setBorderCount(parseInt(e.target.value) || 1)} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm" />
              </label>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-600">
              <label className="flex items-center gap-1"><input type="checkbox" checked={innerRing} onChange={e => setInnerRing(e.target.checked)} /> Inner ring</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={innerRingDashed} disabled={!innerRing} onChange={e => setInnerRingDashed(e.target.checked)} /> Dashed</label>
              <select value={texture} onChange={e => setTexture(e.target.value as any)} className="border rounded px-2 py-1">
                <option value="none">Flat ink</option><option value="ink">Realistic ink</option><option value="grain">Grainy</option>
              </select>
            </div>
            <label className="block text-xs font-medium text-gray-600">Watermark (optional)
              <input value={watermarkText} onChange={e => setWatermarkText(e.target.value)} placeholder="e.g. SPECIMEN" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-2">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Logo / Emblem</h2>
            <input type="file" accept=".png,.svg,.webp" onChange={e => handleUploadAsset(e.target.files?.[0] as File)} className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700" />
            <p className="text-[11px] text-gray-400">PNG / SVG / WebP · transparency preserved · upload only assets your institution is authorised to use.</p>
            {assets.length > 0 && (
              <select
                value={layers.find(l => l.type === 'image')?.assetId || ''}
                onChange={e => {
                  const logoLayer = layers.find(l => l.type === 'image');
                  if (!logoLayer) return;
                  updateLayer(logoLayer.id, { assetId: e.target.value, enabled: Boolean(e.target.value) });
                }}
                className="w-full border rounded-lg px-2 py-2 text-sm"
              >
                <option value="">— No logo —</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            )}
          </section>

          <section className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-2">Layers</h2>
            <div className="space-y-1">
              {[...layers].sort((a, b) => a.zIndex - b.zIndex).map(l => (
                <div key={l.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${selectedId === l.id ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50'}`} onClick={() => setSelectedId(l.id)}>
                  <input type="checkbox" checked={l.enabled} onClick={e => e.stopPropagation()} onChange={e => updateLayer(l.id, { enabled: e.target.checked })} />
                  <span className={`flex-1 truncate ${l.enabled ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{l.name}</span>
                  <span className="text-gray-400">z{l.zIndex}</span>
                </div>
              ))}
            </div>
          </section>

          {selected && (
            <section className="bg-white rounded-xl border p-4 space-y-3">
              <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Layer: {selected.name}</h2>
              {(selected.type === 'curved-text' || selected.type === 'text') && (
                <>
                  <label className="block text-xs font-medium text-gray-600">Content
                    <input value={selected.content || ''} onChange={e => updateLayer(selected.id, { content: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
                  </label>
                  {selected.type === 'curved-text' && (
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-xs text-gray-600">Radius<input type="number" value={selected.curveRadius ?? 225} onChange={e => updateLayer(selected.id, { curveRadius: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
                      <label className="text-xs text-gray-600">Start°<input type="number" value={selected.startAngle ?? -150} onChange={e => updateLayer(selected.id, { startAngle: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
                      <label className="text-xs text-gray-600">End°<input type="number" value={selected.endAngle ?? -30} onChange={e => updateLayer(selected.id, { endAngle: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
                    </div>
                  )}
                </>
              )}
              {selected.type === 'date' && (
                <label className="block text-xs font-medium text-gray-600">Label
                  <input value={selected.label || ''} onChange={e => updateLayer(selected.id, { label: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
                </label>
              )}
              {selected.type === 'verification-marker' && (
                <label className="block text-xs font-medium text-gray-600">Marker text
                  <input value={selected.label || ''} onChange={e => updateLayer(selected.id, { label: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <label>X<input type="number" value={selected.x} onChange={e => updateLayer(selected.id, { x: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Y<input type="number" value={selected.y} onChange={e => updateLayer(selected.id, { y: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Rotation°<input type="number" value={selected.rotation} onChange={e => updateLayer(selected.id, { rotation: parseFloat(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Z-index<input type="number" value={selected.zIndex} onChange={e => updateLayer(selected.id, { zIndex: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Font size<input type="number" value={selected.fontSize} onChange={e => updateLayer(selected.id, { fontSize: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Letter spacing<input type="number" value={selected.letterSpacing} onChange={e => updateLayer(selected.id, { letterSpacing: parseFloat(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Font family
                  <select value={selected.fontFamily} onChange={e => updateLayer(selected.id, { fontFamily: e.target.value })} className="mt-1 w-full border rounded px-2 py-1">
                    <option value="serif">Serif</option><option value="sans-serif">Sans</option><option value="monospace">Mono</option><option value="cursive">Cursive</option>
                  </select>
                </label>
                <label>Weight
                  <select value={selected.fontWeight} onChange={e => updateLayer(selected.id, { fontWeight: e.target.value })} className="mt-1 w-full border rounded px-2 py-1">
                    <option value="normal">Normal</option><option value="bold">Bold</option>
                  </select>
                </label>
                <label>Colour<input type="color" value={selected.color} onChange={e => updateLayer(selected.id, { color: e.target.value })} className="mt-1 w-full h-8 rounded cursor-pointer" /></label>
                <label>Opacity<input type="range" min={0.1} max={1} step={0.05} value={selected.opacity} onChange={e => updateLayer(selected.id, { opacity: parseFloat(e.target.value) })} className="mt-2 w-full" /></label>
              </div>
            </section>
          )}
        </div>

        {/* ── Live preview ── */}
        <div className="col-span-5">
          <div className="bg-white rounded-xl border p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Live Preview</h2>
              <span className="text-[11px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full">engine-rendered</span>
            </div>
            <div
              className="mx-auto flex items-center justify-center"
              style={{ width: 420, height: 420, backgroundImage: 'linear-gradient(45deg,#f8f8f8 25%,transparent 25%),linear-gradient(-45deg,#f8f8f8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f8f8f8 75%),linear-gradient(-45deg,transparent 75%,#f8f8f8 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0' }}
              dangerouslySetInnerHTML={{ __html: svg || '<span style="color:#9ca3af;font-size:13px">Rendering…</span>' }}
            />
            <p className="text-[11px] text-gray-400 mt-3 text-center">
              Finalised documents receive the authoritative date/time and serial number from the server.
            </p>
          </div>
        </div>

        {/* ── Templates ── */}
        <div className="col-span-3 space-y-3">
          <section className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-2">Templates</h2>
            {templates.length === 0 && <p className="text-xs text-gray-400">No templates yet — save your first draft.</p>}
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="border rounded-lg p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 truncate">{t.name}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${t.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : t.status === 'ARCHIVED' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>{t.status}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-400">v{t.version}{t.isDefault ? ' · default' : ''}</span>
                    <div className="flex gap-1">
                      <button onClick={() => loadIntoDesigner(t)} className="px-1.5 py-0.5 border rounded hover:bg-gray-50">Load</button>
                      <button disabled={busy} onClick={() => duplicateTemplate(t)} className="px-1.5 py-0.5 border rounded hover:bg-gray-50">Copy</button>
                      <button onClick={() => toggleVersions(t)} className={`px-1.5 py-0.5 border rounded ${openVersions === t.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>History</button>
                      {!t.isDefault && t.status === 'PUBLISHED' && (
                        <button onClick={() => stampEngineApi.setDefaultTemplate(t.id).then(loadLists)} className="px-1.5 py-0.5 border rounded hover:bg-gray-50">Default</button>
                      )}
                      {t.status !== 'ARCHIVED' && (
                        <button onClick={() => stampEngineApi.archiveTemplate(t.id).then(loadLists)} className="px-1.5 py-0.5 border rounded text-red-600 hover:bg-red-50">Archive</button>
                      )}
                    </div>
                  </div>
                  {openVersions === t.id && (
                    <div className="mt-2 border-t pt-2 space-y-1">
                      {versions.length === 0 && <p className="text-[10px] text-gray-400">No versions recorded.</p>}
                      {versions.map((v: any) => (
                        <div key={v.version} className="flex items-center justify-between gap-2">
                          <span className="truncate text-gray-500" title={v.changeNote || ''}>v{v.version}{v.changeNote ? ` · ${v.changeNote}` : ''}</span>
                          {v.version !== t.version && (
                            <button disabled={busy} onClick={() => rollbackTo(t, v.version)} className="px-1.5 py-0.5 border rounded whitespace-nowrap hover:bg-blue-50">Restore</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="bg-blue-50 rounded-xl border border-blue-100 p-4 text-xs text-blue-900 leading-relaxed">
            <strong>Security note.</strong> The visual stamp is the institutional representation only.
            Authenticity comes from cryptographic hashing, unique serial numbers, audit trails and the public verification endpoint.
          </section>
        </div>
      </div>
    </div>
  );
}
