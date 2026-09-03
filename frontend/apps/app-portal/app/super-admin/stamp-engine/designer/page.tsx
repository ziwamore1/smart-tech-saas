'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stampEngineApi, stampMarketplaceApi } from '@/lib/api';

type ShapeKind =
  | 'triangle' | 'pentagon' | 'hexagon' | 'octagon'
  | 'star' | 'star-4' | 'star-5' | 'star-6' | 'star-8'
  | 'diamond' | 'cross' | 'shield' | 'heart' | 'arrow'
  | 'rounded-rect' | 'square' | 'circle' | 'oval'
  | 'parallelogram' | 'trapezoid' | 'flag';

interface ShapeLayer {
  id: string;
  shape: ShapeKind;
  x: number; y: number;
  size: number;
  width?: number; height?: number;
  fill: string;
  stroke?: string;
  strokeWidth: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  innerRatio?: number;
  rx?: number;
}

const SHAPE_OPTIONS: { value: ShapeKind; label: string }[] = [
  { value: 'shield', label: 'Shield (crest)' },
  { value: 'hexagon', label: 'Hexagon' },
  { value: 'octagon', label: 'Octagon' },
  { value: 'pentagon', label: 'Pentagon' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'star', label: 'Star (5)' },
  { value: 'star-4', label: 'Star (4)' },
  { value: 'star-6', label: 'Star (6)' },
  { value: 'star-8', label: 'Star (8)' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'cross', label: 'Cross' },
  { value: 'heart', label: 'Heart' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'rounded-rect', label: 'Rounded box' },
  { value: 'square', label: 'Square' },
  { value: 'oval', label: 'Oval' },
  { value: 'parallelogram', label: 'Parallelogram' },
  { value: 'trapezoid', label: 'Trapezoid' },
  { value: 'flag', label: 'Banner / pennant' },
];

const CATEGORIES = ['CUSTOM', 'OFFICIAL_SCHOOL', 'EXAMINATION', 'CERTIFICATE', 'VERIFICATION'];
const TIERS = ['STANDARD', 'PREMIUM'];

const CANVAS = 600;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function SuperAdminStampDesignerPage() {
  const [name, setName] = useState('Platform Academic Stamp');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CUSTOM');
  const [minTier, setMinTier] = useState('STANDARD');

  const [outerShape, setOuterShape] = useState<'circle' | 'rectangle' | 'oval'>('circle');
  const [outerRadius, setOuterRadius] = useState(270);
  const [borderColor, setBorderColor] = useState('#1e3a5f');
  const [borderWidth, setBorderWidth] = useState(6);
  const [inkColor, setInkColor] = useState('#123456');

  const [topArc, setTopArc] = useState('REPUBLIC OF ZAMBIA');
  const [bottomArc, setBottomArc] = useState('EDUCATION BOARD');
  const [centerText, setCenterText] = useState('CERTIFIED COPY');
  const [centerSub, setCenterSub] = useState('OFFICIAL');

  const [shapes, setShapes] = useState<ShapeLayer[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [renderMsg, setRenderMsg] = useState('');
  const [svg, setSvg] = useState('');
  const [zoom, setZoom] = useState(1);

  const [showPublish, setShowPublish] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  const configJson = useMemo(() => {
    const cx = CANVAS / 2;
    const cy = CANVAS / 2;
    const layers: any[] = [];
    if (topArc) {
      layers.push({ id: 'arc_top', type: 'curved-text', name: 'Top arc', content: topArc, x: cx, y: 90, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 30, fontWeight: 'bold', letterSpacing: 4, color: inkColor, separator: '★', curve: { centerX: cx, centerY: cy, radius: 225, startAngle: -160, endAngle: -20, orientation: 'outward' } });
    }
    for (const s of shapes) {
      layers.push({ id: s.id, type: 'shape', name: s.id, x: s.x, y: s.y, rotation: s.rotation, opacity: s.opacity, zIndex: s.zIndex, shape: s.shape, size: s.size, width: s.width, height: s.height, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, rx: s.rx, innerRatio: s.innerRatio });
    }
    if (centerText) {
      layers.push({ id: 'txt_center', type: 'text', name: 'Center', content: centerText, x: cx, y: cy + 10, rotation: 0, opacity: 1, zIndex: 30, fontFamily: 'serif', fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: inkColor, direction: 'horizontal' });
    }
    if (centerSub) {
      layers.push({ id: 'txt_sub', type: 'text', name: 'Center sub', content: centerSub, x: cx, y: cy + 40, rotation: 0, opacity: 1, zIndex: 31, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 3, color: inkColor, direction: 'horizontal' });
    }
    if (bottomArc) {
      layers.push({ id: 'arc_bottom', type: 'curved-text', name: 'Bottom arc', content: bottomArc, x: cx, y: cy + 120, rotation: 0, opacity: 1, zIndex: 12, fontFamily: 'serif', fontSize: 22, fontWeight: 'bold', letterSpacing: 3, color: inkColor, curve: { centerX: cx, centerY: cy, radius: 235, startAngle: 150, endAngle: 30, orientation: 'outward' } });
    }
    layers.push({ id: 'date', type: 'date', name: 'Date', label: 'DIGITALLY STAMPED', showTime: true, x: cx, y: cy + 92, rotation: 0, opacity: 1, zIndex: 40, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: '#111827' });
    layers.push({ id: 'serial', type: 'serial', name: 'Serial', label: '', x: cx, y: cy + 130, rotation: 0, opacity: 1, zIndex: 41, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#374151' });

    return {
      canvas: { width: CANVAS, height: CANVAS, background: 'transparent' },
      shape: outerShape === 'circle'
        ? { type: 'circle', outerRadius, borderWidth, borderColor }
        : { type: outerShape, width: outerRadius * 2, height: outerRadius * 1.4, borderWidth, borderColor },
      layers,
      effects: { inkOpacity: 1, texture: 'none' },
    };
  }, [outerShape, outerRadius, borderColor, borderWidth, inkColor, topArc, bottomArc, centerText, centerSub, shapes]);

  // Debounced server-rendered live preview (same engine the PDF pipeline uses).
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await stampEngineApi.renderPreview(configJson, []);
        setSvg(res.data.svg);
        setRenderMsg('');
      } catch (err: any) {
        setRenderMsg(err?.response?.data?.message || 'Preview failed');
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [configJson]);

  const load = useCallback(async () => {
    try {
      const res = await stampMarketplaceApi.adminPlatformList();
      setTemplates(res.data?.templates || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectTemplate = (t: any) => {
    const cfg = t.configJson || {};
    setEditingId(t.id);
    setName(t.name || '');
    setInkColor('#123456');
    setTopArc('REPUBLIC OF ZAMBIA');
    setBottomArc('EDUCATION BOARD');
    setShapes((cfg.layers || []).filter((l: any) => l.type === 'shape').map((l: any) => ({
      id: l.id, shape: l.shape || 'shield', x: l.x, y: l.y, size: l.size ?? 100, width: l.width, height: l.height,
      fill: l.fill || '#1e3a5f', stroke: l.stroke, strokeWidth: l.strokeWidth ?? 0, rotation: l.rotation ?? 0, opacity: l.opacity ?? 1, zIndex: l.zIndex ?? 20, innerRatio: l.innerRatio, rx: l.rx,
    })));
  };

  const updateShape = (id: string, patch: Partial<ShapeLayer>) =>
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));

  const getCoords = (e: React.MouseEvent) => {
    const el = previewRef.current;
    if (!el) return { cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    return { cx: (e.clientX - rect.left) * (CANVAS / rect.width), cy: (e.clientY - rect.top) * (CANVAS / rect.height) };
  };
  const dragPos = useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const onPreviewDown = (e: React.MouseEvent) => {
    if (!selectedShapeId || busy) return;
    const layer = shapes.find(s => s.id === selectedShapeId);
    if (!layer) return;
    const c = getCoords(e);
    dragPos.current = { id: selectedShapeId, startX: c.cx, startY: c.cy, x: layer.x, y: layer.y };
    e.preventDefault();
  };
  const onPreviewMove = (e: React.MouseEvent) => {
    if (!dragPos.current) return;
    const c = getCoords(e);
    const dx = c.cx - dragPos.current.startX;
    const dy = c.cy - dragPos.current.startY;
    updateShape(dragPos.current.id, {
      x: Math.max(0, Math.min(CANVAS, dragPos.current.x + dx)),
      y: Math.max(0, Math.min(CANVAS, dragPos.current.y + dy)),
    });
  };
  const onPreviewUp = () => { dragPos.current = null; };

  const addShape = (shape: ShapeKind) => {
    const id = uid();
    setShapes(prev => [...prev, {
      id, shape, x: CANVAS / 2, y: CANVAS / 2, size: 110,
      fill: inkColor, stroke: undefined, strokeWidth: 0,
      rotation: 0, opacity: 1, zIndex: 20 + prev.length,
      innerRatio: shape === 'star' || shape.startsWith('star') ? 0.5 : undefined,
    }]);
    setSelectedShapeId(id);
  };

  const save = async () => {
    if (!name.trim()) { setMessage('Give the stamp a name first.'); return; }
    setBusy(true);
    try {
      if (editingId) {
        await stampMarketplaceApi.adminPlatformUpdate(editingId, { name: name.trim(), configJson });
      } else {
        const res = await stampMarketplaceApi.adminPlatformCreate({ name: name.trim(), configJson });
        setEditingId(res.data?.id);
      }
      setMessage('Platform stamp saved.');
      void load();
    } catch (err: any) { setMessage(err?.response?.data?.message || 'Could not save stamp'); }
    finally { setBusy(false); }
  };

  const publish = async () => {
    if (!editingId) {
      setMessage('Save the stamp first, then publish.');
      return;
    }
    setPublishing(true);
    try {
      await stampMarketplaceApi.adminPublish(editingId, {
        name: name.trim(), description, category, minTier,
        tags: [category, 'advanced', 'platform'],
      });
      setMessage('Published to the Stamp Marketplace. STANDARD/PREMIUM schools can now install it.');
      setShowPublish(false);
    } catch (err: any) { setMessage(err?.response?.data?.message || 'Could not publish'); }
    finally { setPublishing(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Advanced Stamp Designer</h1>
        <p className="text-sm text-gray-500 mt-1">Author a realistic, layer-based institutional stamp with the free-position shape tool, then publish it to STANDARD + PREMIUM schools via the Stamp Marketplace.</p>
      </div>

      {message && <div className="text-sm px-4 py-2 rounded-lg bg-blue-50 text-blue-800">{message}</div>}
      {renderMsg && <div className="text-sm px-4 py-2 rounded-lg bg-red-50 text-red-700">{renderMsg}</div>}

      <div className="grid lg:grid-cols-[340px_1fr_280px] gap-6">
        {/* Left: template + stamp details */}
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Save / load</h2>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Platform stamp name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <button onClick={save} disabled={busy} className="w-full rounded-lg bg-violet-700 text-white py-2.5 font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Platform Stamp'}</button>
            <select onChange={e => { const t = templates.find(x => x.id === e.target.value); if (t) selectTemplate(t); }} value={editingId || ''} className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
              <option value="">— Load existing —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Outer shape</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['circle', 'rectangle', 'oval'] as const).map(s => (
                <button key={s} onClick={() => setOuterShape(s)} className={`px-2 py-1.5 text-xs border rounded-lg capitalize ${outerShape === s ? 'bg-violet-50 border-violet-400 text-violet-700' : 'hover:bg-gray-50'}`}>{s}</button>
              ))}
            </div>
            <label className="block text-xs text-gray-600">Radius: {outerRadius}px<input className="w-full" type="range" min="140" max="285" value={outerRadius} onChange={e => setOuterRadius(Number(e.target.value))} /></label>
            <label className="block text-xs text-gray-600">Ink colour<input type="color" value={inkColor} onChange={e => setInkColor(e.target.value)} className="mt-1 w-full h-8 rounded cursor-pointer" /></label>
            <label className="block text-xs text-gray-600">Border colour<input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="mt-1 w-full h-8 rounded cursor-pointer" /></label>
            <label className="block text-xs text-gray-600">Border width: {borderWidth}<input className="w-full" type="range" min="2" max="12" value={borderWidth} onChange={e => setBorderWidth(Number(e.target.value))} /></label>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Text</h2>
            <label className="block text-xs text-gray-600">Top arc<input value={topArc} onChange={e => setTopArc(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs text-gray-600">Bottom arc<input value={bottomArc} onChange={e => setBottomArc(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs text-gray-600">Center<input value={centerText} onChange={e => setCenterText(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
            <label className="block text-xs text-gray-600">Center sub<input value={centerSub} onChange={e => setCenterSub(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Shape tool</h2>
            <select onChange={e => addShape(e.target.value as ShapeKind)} value="" className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
              <option value="">+ Add a secondary shape…</option>
              {SHAPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {shapes.length === 0 && <p className="text-[11px] text-gray-400">Add shields, stars, hexagons, diamonds, boxes… then drag them on the canvas and recolor to the ink.</p>}
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {shapes.map(s => (
                <div key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${selectedShapeId === s.id ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`} onClick={() => setSelectedShapeId(s.id)}>
                  <span className="flex-1 truncate text-gray-700">{s.shape}</span>
                  <span className="text-gray-400">z{s.zIndex}</span>
                  <button onClick={() => setShapes(prev => prev.filter(x => x.id !== s.id))} className="text-red-500 hover:text-red-700">✕</button>
                </div>
              ))}
            </div>
            {shapes.find(s => s.id === selectedShapeId) && (() => {
              const sel = shapes.find(s => s.id === selectedShapeId)!;
              return (
                <div className="space-y-2 text-xs text-gray-600 border-t pt-2">
                  <label className="block">Shape
                    <select value={sel.shape} onChange={e => updateShape(sel.id, { shape: e.target.value as ShapeKind })} className="mt-1 w-full border rounded-lg px-2 py-1.5">
                      {SHAPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label>Size<input type="number" min={20} max={400} value={sel.size} onChange={e => updateShape(sel.id, { size: parseInt(e.target.value) || 20 })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                    <label>Rotation°<input type="number" value={sel.rotation} onChange={e => updateShape(sel.id, { rotation: parseFloat(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                    <label>X<input type="number" value={sel.x} onChange={e => updateShape(sel.id, { x: parseInt(e.target.value) || 0 })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                    <label>Y<input type="number" value={sel.y} onChange={e => updateShape(sel.id, { y: parseInt(e.target.value) || 0 })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                    <label>Ink fill<input type="color" value={sel.fill} onChange={e => updateShape(sel.id, { fill: e.target.value })} className="mt-1 w-full h-8 rounded cursor-pointer" /></label>
                    <label>Opacity<input type="number" min={0.1} max={1} step={0.05} value={sel.opacity} onChange={e => updateShape(sel.id, { opacity: parseFloat(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                  </div>
                  <p className="text-[10px] text-gray-400">Drag on the canvas to move it. Set the ink fill to match the stamp colour.</p>
                </div>
              );
            })()}
          </section>
        </div>

        {/* Center: live preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Live preview</h2>
            <span className="text-[11px] text-gray-400">{Math.round(zoom * 100)}% · engine-rendered</span>
          </div>
          <div
            ref={previewRef}
            className="mx-auto rounded-lg select-none relative cursor-crosshair"
            style={{
              width: 600 * zoom, height: 600 * zoom,
              backgroundImage: 'linear-gradient(45deg,#f0f0f0 25%,transparent 25%),linear-gradient(-45deg,#f0f0f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f0f0 75%),linear-gradient(-45deg,transparent 75%,#f0f0f0 75%)',
              backgroundSize: `${16 * zoom}px ${16 * zoom}px`,
              backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
            }}
            onMouseDown={onPreviewDown}
            onMouseMove={onPreviewMove}
            onMouseUp={onPreviewUp}
            onMouseLeave={onPreviewUp}
          >
            <div className="w-full h-full flex items-center justify-center" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
              <div dangerouslySetInnerHTML={{ __html: svg || '<span style="color:#9ca3af;font-size:13px">Rendering…</span>' }} />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">−</button>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">＋</button>
            <span className="text-[11px] text-gray-400 ml-2">Tip: select a shape, then drag it on the canvas to position it.</span>
          </div>
        </div>

        {/* Right: publish */}
        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Publish to Marketplace</h2>
            <p className="text-[11px] text-gray-400 mt-1">Publishing makes this stamp available for STANDARD and PREMIUM schools to install into their own stamp libraries.</p>
            <button onClick={() => setShowPublish(v => !v)} className="mt-3 w-full rounded-lg bg-sky-600 text-white py-2.5 font-semibold">{showPublish ? 'Hide details' : 'Configure publish'}</button>
            {showPublish && (
              <div className="mt-3 space-y-3 text-xs text-gray-600">
                <label className="block">Description<textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
                <label className="block">Category
                  <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-1.5">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="block">Minimum tier
                  <select value={minTier} onChange={e => setMinTier(e.target.value)} className="mt-1 w-full border rounded-lg px-2 py-1.5">
                    {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <button onClick={() => void publish()} disabled={publishing} className="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-semibold disabled:opacity-50">{publishing ? 'Publishing…' : 'Publish Stamp'}</button>
              </div>
            )}
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Saved platform stamps</h2>
            <ul className="mt-2 divide-y divide-gray-100">
              {templates.length === 0 && <li className="py-2 text-xs text-gray-400">None yet. Save your first stamp above.</li>}
              {templates.map(t => (
                <li key={t.id} className="py-2 flex items-center gap-2 text-xs">
                  <span className={`flex-1 truncate ${editingId === t.id ? 'text-violet-700 font-medium' : 'text-gray-700'}`}>{t.name}</span>
                  <span className="text-gray-400">v{t.version}</span>
                  <button onClick={() => selectTemplate(t)} className="text-violet-600 hover:underline">Edit</button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
