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

interface ContentLayer {
  id: string;
  type: 'text' | 'image';
  name: string;
  content?: string;
  assetId?: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  align: 'start' | 'middle' | 'end';
  rotation: number;
  opacity: number;
  zIndex: number;
}

interface CurvedTextLayer {
  id: string;
  name: string;
  content: string;
  x: number;
  y: number;
  radius: number;
  startAngle: number;
  endAngle: number;
  rotation: number;
  fontSize: number;
  letterSpacing: number;
  fontWeight: string;
  orientation: 'outward' | 'inward';
  separator: string;
  separatorPlacement: 'gap' | 'ends' | 'custom';
  separatorAngle: number;
  separatorOffset: number;
  opacity: number;
  zIndex: number;
}

type SystemLayerId = 'date' | 'serial';

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
const STAMP_TYPES = ['VERIFIED', 'PAID', 'APPROVED', 'CONFIDENTIAL', 'PRINCIPAL', 'EXAMINATION', 'REGISTRAR', 'DEPARTMENT', 'REGISTRATION BOARD'];
const SEPARATOR_OPTIONS = ['', '★', '•', '✦', '✧', '◆', '◇', '✚', '✠', '✶', '❖', '|'];

const CANVAS = 600;
const uid = () => Math.random().toString(36).slice(2, 10);

export default function SuperAdminStampDesignerPage() {
  const [name, setName] = useState('Platform Academic Stamp');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('CUSTOM');
  const [minTier, setMinTier] = useState('STANDARD');

  const [outerShape, setOuterShape] = useState<'circle' | 'rectangle' | 'oval'>('circle');
  const [outerRadius, setOuterRadius] = useState(270);
  const [innerRadius, setInnerRadius] = useState(242);
  const [borderColor, setBorderColor] = useState('#1e3a5f');
  const [borderWidth, setBorderWidth] = useState(6);
  const [inkColor, setInkColor] = useState('#123456');

  const [centerText, setCenterText] = useState('CERTIFIED COPY');
  const [centerSub, setCenterSub] = useState('OFFICIAL');
  const [stampType, setStampType] = useState('VERIFIED');

  const [shapes, setShapes] = useState<ShapeLayer[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [contentLayers, setContentLayers] = useState<ContentLayer[]>([
    { id: 'institution', type: 'text', name: 'Institution name', content: 'INSTITUTION NAME', x: 300, y: 105, width: 500, height: 40, fontSize: 28, fontWeight: 'bold', letterSpacing: 3, align: 'middle', rotation: 0, opacity: 1, zIndex: 15 },
    { id: 'stamp-type', type: 'text', name: 'Stamp type', content: 'CERTIFIED COPY', x: 300, y: 300, width: 460, height: 40, fontSize: 24, fontWeight: 'bold', letterSpacing: 2, align: 'middle', rotation: 0, opacity: 1, zIndex: 30 },
    { id: 'department', type: 'text', name: 'Office / department', content: 'OFFICIAL', x: 300, y: 345, width: 440, height: 32, fontSize: 16, fontWeight: 'normal', letterSpacing: 2, align: 'middle', rotation: 0, opacity: 1, zIndex: 31 },
  ]);
  const [assets, setAssets] = useState<any[]>([]);
  const [selectedContentId, setSelectedContentId] = useState<string | null>(null);
  const [selectedSystemId, setSelectedSystemId] = useState<SystemLayerId | null>(null);
  const [systemPositions, setSystemPositions] = useState<Record<SystemLayerId, { x: number; y: number }>>({ date: { x: 300, y: 392 }, serial: { x: 300, y: 430 } });
  const [curvedLayers, setCurvedLayers] = useState<CurvedTextLayer[]>([
    { id: 'arc_top', name: 'Top circular text', content: 'REPUBLIC OF ZAMBIA', x: 300, y: 300, radius: 225, startAngle: -60, endAngle: 60, rotation: 0, fontSize: 30, letterSpacing: 4, fontWeight: 'bold', orientation: 'outward', separator: '★', separatorPlacement: 'ends', separatorAngle: 180, separatorOffset: 30, opacity: 1, zIndex: 10 },
    { id: 'arc_bottom', name: 'Bottom circular text', content: 'EDUCATION BOARD', x: 300, y: 300, radius: 235, startAngle: 240, endAngle: 120, rotation: 0, fontSize: 22, letterSpacing: 3, fontWeight: 'bold', orientation: 'inward', separator: '', separatorPlacement: 'gap', separatorAngle: 180, separatorOffset: 30, opacity: 1, zIndex: 12 },
  ]);
  const [selectedCurvedId, setSelectedCurvedId] = useState<string | null>(null);

  const [templates, setTemplates] = useState<any[]>([]);
  const [listError, setListError] = useState('');
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
    if (outerShape !== 'rectangle') for (const layer of curvedLayers) layers.push({ id: layer.id, type: 'curved-text', name: layer.name, content: layer.content, x: layer.x, y: layer.y, rotation: layer.rotation, opacity: layer.opacity, zIndex: layer.zIndex, fontFamily: 'serif', fontSize: layer.fontSize, fontWeight: layer.fontWeight, letterSpacing: layer.letterSpacing, color: inkColor, separator: layer.separator || undefined, separatorPlacement: layer.separatorPlacement, separatorAngle: layer.separatorAngle, separatorOffset: layer.separatorOffset, curve: { centerX: layer.x, centerY: layer.y, radius: layer.radius, startAngle: layer.startAngle, endAngle: layer.endAngle, orientation: layer.orientation } });
    for (const s of shapes) {
      layers.push({ id: s.id, type: 'shape', name: s.id, x: s.x, y: s.y, rotation: s.rotation, opacity: s.opacity, zIndex: s.zIndex, shape: s.shape, size: s.size, width: s.width, height: s.height, fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, rx: s.rx, innerRatio: s.innerRatio });
    }
    for (const layer of contentLayers) {
      if (layer.type === 'image') {
         layers.push({ id: layer.id, type: 'image', name: layer.name, assetId: layer.assetId, url: layer.url, x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation, opacity: layer.opacity, zIndex: layer.zIndex });
      } else {
        layers.push({ id: layer.id, type: 'text', name: layer.name, content: layer.content || '', x: layer.x, y: layer.y, rotation: layer.rotation, opacity: layer.opacity, zIndex: layer.zIndex, fontFamily: 'sans-serif', fontSize: layer.fontSize, fontWeight: layer.fontWeight, letterSpacing: layer.letterSpacing, color: inkColor, align: layer.align, direction: 'horizontal' });
      }
    }
    layers.push({ id: 'date', type: 'date', name: 'Date', label: 'DIGITALLY STAMPED', showTime: true, x: systemPositions.date.x, y: systemPositions.date.y, rotation: 0, opacity: 1, zIndex: 40, fontFamily: 'sans-serif', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: '#111827' });
    layers.push({ id: 'serial', type: 'serial', name: 'Serial', label: '', x: systemPositions.serial.x, y: systemPositions.serial.y, rotation: 0, opacity: 1, zIndex: 41, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#374151' });

    return {
      canvas: { width: CANVAS, height: CANVAS, background: 'transparent' },
      shape: outerShape === 'circle'
        ? { type: 'circle', outerRadius, borderWidth, borderColor, innerRings: [{ radius: Math.min(innerRadius, outerRadius - 4), width: 2, color: borderColor, dashed: false }] }
        : { type: outerShape, width: outerRadius * 2, height: outerRadius * 1.4, borderWidth, borderColor, innerRings: [{ inset: 24, width: 2, color: borderColor, dashed: false }] },
      layers,
      effects: { inkOpacity: 1, texture: 'none' },
    };
  }, [outerShape, outerRadius, innerRadius, borderColor, borderWidth, inkColor, shapes, contentLayers, curvedLayers, systemPositions]);

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
      const [res, assetRes] = await Promise.all([
        stampMarketplaceApi.adminPlatformList(),
        stampEngineApi.listAssets().catch(() => ({ data: { assets: [] } })),
      ]);
      const list = res.data?.templates;
      setTemplates(Array.isArray(list) ? list : []);
      setListError(Array.isArray(list) ? '' : 'Unexpected response from the marketplace service.');
      setAssets(assetRes.data?.assets || []);
    } catch (err: any) {
      setTemplates([]);
      setListError(err?.response?.data?.message || 'Could not load saved platform stamps.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selectTemplate = (t: any) => {
    const cfg = t.configJson || {};
    setEditingId(t.id);
    setName(t.name || '');
    setOuterShape(cfg.shape?.type || 'circle');
    setOuterRadius(cfg.shape?.outerRadius || 270);
    setInnerRadius(cfg.shape?.innerRings?.[0]?.radius || Math.max(60, (cfg.shape?.outerRadius || 270) - 28));
    setInkColor('#123456');
       setShapes((cfg.layers || []).filter((l: any) => l.type === 'shape').map((l: any) => ({
      id: l.id, shape: l.shape || 'shield', x: l.x, y: l.y, size: l.size ?? 100, width: l.width, height: l.height,
      fill: l.fill || '#1e3a5f', stroke: l.stroke, strokeWidth: l.strokeWidth ?? 0, rotation: l.rotation ?? 0, opacity: l.opacity ?? 1, zIndex: l.zIndex ?? 20, innerRatio: l.innerRatio, rx: l.rx,
       })));
       const loadedDate = (cfg.layers || []).find((l: any) => l.id === 'date');
       const loadedSerial = (cfg.layers || []).find((l: any) => l.id === 'serial');
       setSystemPositions({ date: { x: loadedDate?.x ?? 300, y: loadedDate?.y ?? 392 }, serial: { x: loadedSerial?.x ?? 300, y: loadedSerial?.y ?? 430 } });
       const loadedContentLayers = (cfg.layers || []).filter((l: any) => l.type === 'text' || l.type === 'image').map((l: any) => ({
         id: l.id || uid(), type: l.type, name: l.name || l.type, content: l.content, assetId: l.assetId || '', url: l.url || '', x: l.x ?? 300, y: l.y ?? 300,
         width: l.width ?? 300, height: l.height ?? 40, fontSize: l.fontSize ?? 18, fontWeight: l.fontWeight || 'normal',
         letterSpacing: l.letterSpacing ?? 0, align: l.align || 'middle', rotation: l.rotation ?? 0, opacity: l.opacity ?? 1, zIndex: l.zIndex ?? 20,
       }));
       setContentLayers(loadedContentLayers);
       const loadedStampType = loadedContentLayers.find((l: any) => l.id === 'stamp-type')?.content;
       if (loadedStampType && STAMP_TYPES.includes(loadedStampType)) setStampType(loadedStampType);
       const loadedCenter = loadedContentLayers.find((l: any) => l.id === 'stamp-type')?.content;
       if (loadedCenter) setCenterText(loadedCenter);
       const loadedSub = loadedContentLayers.find((l: any) => l.id === 'department')?.content;
       if (loadedSub) setCenterSub(loadedSub);
      setCurvedLayers((cfg.layers || []).filter((l: any) => l.type === 'curved-text').map((l: any) => ({
        id: l.id || uid(), name: l.name || 'Circular text', content: l.content || '', x: l.curve?.centerX ?? l.x ?? 300, y: l.curve?.centerY ?? l.y ?? 300,
        radius: l.curve?.radius ?? 220, startAngle: l.curve?.startAngle ?? -60, endAngle: l.curve?.endAngle ?? 60, rotation: l.rotation ?? 0, fontSize: l.fontSize ?? 24,
        letterSpacing: l.letterSpacing ?? 2, fontWeight: l.fontWeight || 'bold', orientation: l.curve?.orientation || 'outward', separator: l.separator || '', separatorPlacement: l.separatorPlacement || 'gap', separatorAngle: l.separatorAngle ?? 180, separatorOffset: l.separatorOffset ?? 30, opacity: l.opacity ?? 1, zIndex: l.zIndex ?? 10,
      })));
  };

  const updateShape = (id: string, patch: Partial<ShapeLayer>) =>
    setShapes(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const updateContent = (id: string, patch: Partial<ContentLayer>) =>
    setContentLayers(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const updateCurved = (id: string, patch: Partial<CurvedTextLayer>) => setCurvedLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  const applyArcPreset = (id: string, preset: 'top' | 'bottom' | 'left' | 'right') => {
    const paths = {
      top: { startAngle: -60, endAngle: 60, orientation: 'outward' as const },
      bottom: { startAngle: 240, endAngle: 120, orientation: 'inward' as const },
      left: { startAngle: 210, endAngle: 330, orientation: 'outward' as const },
      right: { startAngle: 30, endAngle: 150, orientation: 'outward' as const },
    };
    updateCurved(id, paths[preset]);
  };
  const addCurvedText = (preset: 'top' | 'bottom' | 'left' | 'right' = 'top') => {
    const id = uid();
    const paths = { top: [-60, 60, 'outward'], bottom: [240, 120, 'inward'], left: [210, 330, 'outward'], right: [30, 150, 'outward'] } as const;
    const [startAngle, endAngle, orientation] = paths[preset];
    setCurvedLayers(prev => [...prev, { id, name: `Custom ${preset} arc`, content: 'CIRCULAR TEXT', x: 300, y: 300, radius: 190, startAngle, endAngle, rotation: 0, fontSize: 20, letterSpacing: 2, fontWeight: 'bold', orientation, separator: '', separatorPlacement: 'gap', separatorAngle: 180, separatorOffset: 30, opacity: 1, zIndex: 50 + prev.length }]);
    setSelectedCurvedId(id);
    setSelectedShapeId(null); setSelectedContentId(null);
  };

  const changeStampType = (next: string) => {
    setStampType(next);
    setCenterText(next);
    setContentLayers(prev => prev.map(layer => layer.id === 'stamp-type' ? { ...layer, content: next } : layer));
  };

  const addContent = (type: 'text' | 'image') => {
    const id = uid();
    const layer: ContentLayer = { id, type, name: type === 'text' ? 'Custom text' : 'Emblem / logo', content: type === 'text' ? 'CUSTOM TEXT' : undefined, assetId: '', x: 300, y: 300, width: type === 'text' ? 360 : 90, height: type === 'text' ? 40 : 90, fontSize: 18, fontWeight: 'bold', letterSpacing: 1, align: 'middle', rotation: 0, opacity: 1, zIndex: 50 + contentLayers.length };
    setContentLayers(prev => [...prev, layer]);
     setSelectedContentId(id);
     setSelectedSystemId(null);
  };

  const addSeparator = () => {
    const id = uid();
    setContentLayers(prev => [...prev, { id, type: 'text', name: 'Independent separator', content: '★', x: 300, y: 450, width: 40, height: 40, fontSize: 24, fontWeight: 'bold', letterSpacing: 0, align: 'middle', rotation: 0, opacity: 1, zIndex: 55 + prev.length }]);
    setSelectedContentId(id);
     setSelectedShapeId(null); setSelectedCurvedId(null); setSelectedSystemId(null);
  };

  const uploadAsset = async (file?: File) => {
    if (!file) return;
    try {
      const res = await stampEngineApi.uploadPlatformAsset(file, file.name.replace(/\.[^.]+$/, ''), 'LOGO');
      setAssets(prev => [res.data, ...prev]);
      const id = uid();
      setContentLayers(prev => [...prev, { id, type: 'image', name: file.name, assetId: res.data.id, url: res.data.url, x: 300, y: 300, width: 100, height: 100, fontSize: 12, fontWeight: 'normal', letterSpacing: 0, align: 'middle', rotation: 0, opacity: 1, zIndex: 50 + prev.length }]);
       setSelectedContentId(id);
       setSelectedSystemId(null);
     } catch (err: any) {
       if (file.size <= 2 * 1024 * 1024 && ['image/png', 'image/svg+xml', 'image/webp'].includes(file.type)) {
         const url = await new Promise<string>((resolve, reject) => {
           const reader = new FileReader();
           reader.onload = () => resolve(String(reader.result));
           reader.onerror = reject;
           reader.readAsDataURL(file);
         });
         const id = uid();
         setContentLayers(prev => [...prev, { id, type: 'image', name: file.name, assetId: '', url, x: 300, y: 300, width: 100, height: 100, fontSize: 12, fontWeight: 'normal', letterSpacing: 0, align: 'middle', rotation: 0, opacity: 1, zIndex: 50 + prev.length }]);
         setSelectedContentId(id);
         setSelectedSystemId(null);
         setMessage('Logo added to this draft. The server upload was unavailable, so it will be saved with the draft.');
       } else {
         setMessage(err?.response?.data?.message || err?.message || 'Could not upload emblem');
       }
     }
  };

  const getCoords = (e: React.MouseEvent) => {
    const el = previewRef.current;
    if (!el) return { cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    return { cx: (e.clientX - rect.left) * (CANVAS / rect.width), cy: (e.clientY - rect.top) * (CANVAS / rect.height) };
  };
  const dragPos = useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const onPreviewDown = (e: React.MouseEvent) => {
    if (busy) return;
    const layer = selectedShapeId ? shapes.find(s => s.id === selectedShapeId) : selectedContentId ? contentLayers.find(l => l.id === selectedContentId) : selectedCurvedId ? curvedLayers.find(l => l.id === selectedCurvedId) : null;
    const systemLayer = selectedSystemId ? systemPositions[selectedSystemId] : null;
    if (!layer && !systemLayer) return;
    const c = getCoords(e);
    dragPos.current = { id: layer?.id || selectedSystemId || '', startX: c.cx, startY: c.cy, x: layer?.x ?? systemLayer!.x, y: layer?.y ?? systemLayer!.y };
    e.preventDefault();
  };
  const onPreviewMove = (e: React.MouseEvent) => {
    if (!dragPos.current) return;
    const c = getCoords(e);
    const dx = c.cx - dragPos.current.startX;
    const dy = c.cy - dragPos.current.startY;
    if (selectedShapeId) updateShape(dragPos.current.id, {
      x: Math.max(0, Math.min(CANVAS, dragPos.current.x + dx)),
      y: Math.max(0, Math.min(CANVAS, dragPos.current.y + dy)),
    });
    else if (selectedContentId) updateContent(dragPos.current.id, { x: Math.max(0, Math.min(CANVAS, dragPos.current.x + dx)), y: Math.max(0, Math.min(CANVAS, dragPos.current.y + dy)) });
    else if (selectedSystemId) setSystemPositions(prev => ({ ...prev, [selectedSystemId]: { x: Math.max(0, Math.min(CANVAS, dragPos.current!.x + dx)), y: Math.max(0, Math.min(CANVAS, dragPos.current!.y + dy)) } }));
    else updateCurved(dragPos.current.id, { x: Math.max(0, Math.min(CANVAS, dragPos.current.x + dx)), y: Math.max(0, Math.min(CANVAS, dragPos.current.y + dy)) });
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
    setSelectedContentId(null);
    setSelectedCurvedId(null);
    setSelectedSystemId(null);
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
       setMessage('Stamp draft saved. It is not available to schools until published.');
      void load();
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.message || 'Could not save stamp';
      setMessage(Array.isArray(detail) ? detail.join(', ') : String(detail));
    }
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
            <button onClick={save} disabled={busy} className="w-full rounded-lg bg-violet-700 text-white py-2.5 font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Draft'}</button>
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
            {outerShape === 'circle' && <label className="block text-xs text-gray-600">Inner circle radius: {innerRadius}px<input className="w-full" type="range" min="30" max={Math.max(30, outerRadius - 4)} value={Math.min(innerRadius, outerRadius - 4)} onChange={e => setInnerRadius(Number(e.target.value))} /></label>}
            <label className="block text-xs text-gray-600">Ink colour<input type="color" value={inkColor} onChange={e => setInkColor(e.target.value)} className="mt-1 w-full h-8 rounded cursor-pointer" /></label>
            <label className="block text-xs text-gray-600">Border colour<input type="color" value={borderColor} onChange={e => setBorderColor(e.target.value)} className="mt-1 w-full h-8 rounded cursor-pointer" /></label>
            <label className="block text-xs text-gray-600">Border width: {borderWidth}<input className="w-full" type="range" min="2" max="12" value={borderWidth} onChange={e => setBorderWidth(Number(e.target.value))} /></label>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Text</h2>
            <label className="block text-xs text-gray-600">Center<input value={centerText} onChange={e => setCenterText(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
             <label className="block text-xs text-gray-600">Stamp type<select value={stampType} onChange={e => changeStampType(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{STAMP_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
            <label className="block text-xs text-gray-600">Center sub<input value={centerSub} onChange={e => setCenterSub(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /></label>
          </section>
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
             <div className="flex items-center justify-between"><h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Circular text</h2><div className="flex flex-wrap gap-1"><button onClick={() => addCurvedText('top')} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Top</button><button onClick={() => addCurvedText('bottom')} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Bottom</button><button onClick={() => addCurvedText('left')} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Left</button><button onClick={() => addCurvedText('right')} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Right</button></div></div>
            <p className="text-[10px] text-gray-400">Select an arc to edit its path, radius, angle range, size, and exact center. Drag it on the preview to reposition it.</p>
             <div className="space-y-1">{curvedLayers.map(layer => <div key={layer.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${selectedCurvedId === layer.id ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`} onClick={() => { setSelectedCurvedId(layer.id); setSelectedShapeId(null); setSelectedContentId(null); setSelectedSystemId(null); }}><span className="flex-1 truncate">{layer.name}</span><button onClick={e => { e.stopPropagation(); setCurvedLayers(prev => prev.filter(x => x.id !== layer.id)); }} className="text-red-500">✕</button></div>)}</div>
             {curvedLayers.find(l => l.id === selectedCurvedId) && (() => { const sel = curvedLayers.find(l => l.id === selectedCurvedId)!; return <div className="border-t pt-2 space-y-2 text-xs text-gray-600"><label className="block">Name<input value={sel.name} onChange={e => updateCurved(sel.id, { name: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" /></label><label className="block">Text<input value={sel.content} onChange={e => updateCurved(sel.id, { content: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" /></label><div className="grid grid-cols-2 gap-2"><label>Center X<input type="number" value={sel.x} onChange={e => updateCurved(sel.id, { x: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Center Y<input type="number" value={sel.y} onChange={e => updateCurved(sel.id, { y: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Radius<input type="number" min={20} value={sel.radius} onChange={e => updateCurved(sel.id, { radius: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Font size<input type="number" min={6} value={sel.fontSize} onChange={e => updateCurved(sel.id, { fontSize: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Start angle<input type="number" value={sel.startAngle} onChange={e => updateCurved(sel.id, { startAngle: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>End angle<input type="number" value={sel.endAngle} onChange={e => updateCurved(sel.id, { endAngle: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Rotation°<input type="number" value={sel.rotation} onChange={e => updateCurved(sel.id, { rotation: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label></div><div className="grid grid-cols-2 gap-2"><label>Letter spacing<input type="number" value={sel.letterSpacing} onChange={e => updateCurved(sel.id, { letterSpacing: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Direction<select value={sel.orientation} onChange={e => updateCurved(sel.id, { orientation: e.target.value as CurvedTextLayer['orientation'] })} className="mt-1 w-full border rounded px-2 py-1"><option value="outward">Outward</option><option value="inward">Inward</option></select></label></div><div className="grid grid-cols-2 gap-2"><label>Separator<select value={SEPARATOR_OPTIONS.includes(sel.separator) ? sel.separator : ''} onChange={e => updateCurved(sel.id, { separator: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5">{SEPARATOR_OPTIONS.map((separator, index) => <option key={`${separator}-${index}`} value={separator}>{separator || 'None'}</option>)}</select></label><label>Custom separator<input value={SEPARATOR_OPTIONS.includes(sel.separator) ? '' : sel.separator} onChange={e => updateCurved(sel.id, { separator: e.target.value })} placeholder="Any symbol or text" className="mt-1 w-full border rounded px-2 py-1.5" /></label></div><div className="grid grid-cols-2 gap-2"><label>Placement<select value={sel.separatorPlacement} onChange={e => updateCurved(sel.id, { separatorPlacement: e.target.value as CurvedTextLayer['separatorPlacement'] })} className="mt-1 w-full border rounded px-2 py-1"><option value="gap">Gap center</option><option value="ends">Both arc ends</option><option value="custom">Custom angle</option></select></label><label>Custom angle<input type="number" value={sel.separatorAngle} disabled={sel.separatorPlacement !== 'custom'} onChange={e => updateCurved(sel.id, { separatorAngle: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 disabled:bg-gray-100" /></label></div><label className="block">End offset: {sel.separatorOffset}°<input type="range" min="0" max="60" value={sel.separatorOffset} onChange={e => updateCurved(sel.id, { separatorOffset: Number(e.target.value) })} className="w-full" /></label></div>; })()}
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
                   <div key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${selectedShapeId === s.id ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`} onClick={() => { setSelectedShapeId(s.id); setSelectedContentId(null); setSelectedCurvedId(null); setSelectedSystemId(null); }}>
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
          <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
             <div className="flex items-center justify-between"><h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Text & emblems</h2><div className="flex flex-wrap gap-1"><button onClick={() => addContent('text')} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Text</button><button onClick={addSeparator} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Separator</button><button onClick={() => addContent('image')} className="px-2 py-1 text-[11px] border rounded text-violet-700">+ Emblem</button></div></div>
            <input type="file" accept=".png,.svg,.webp" onChange={e => void uploadAsset(e.target.files?.[0])} className="block w-full text-[11px] text-gray-500" />
             <p className="text-[10px] text-gray-400">Add multiple logos or emblems and position each independently on the template.</p>
             <div className="space-y-1 max-h-36 overflow-y-auto">{contentLayers.map(layer => <div key={layer.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${selectedContentId === layer.id ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`} onClick={() => { setSelectedContentId(layer.id); setSelectedShapeId(null); setSelectedCurvedId(null); setSelectedSystemId(null); }}><span className="flex-1 truncate">{layer.name}</span><span className="text-gray-400">{layer.type}</span><button onClick={e => { e.stopPropagation(); setContentLayers(prev => prev.filter(x => x.id !== layer.id)); }} className="text-red-500">✕</button></div>)}</div>
             <div className="space-y-1 border-t pt-2"><p className="text-[10px] font-semibold text-gray-500 uppercase">System fields</p>{(['date', 'serial'] as SystemLayerId[]).map(id => <button key={id} onClick={() => { setSelectedSystemId(id); setSelectedContentId(null); setSelectedShapeId(null); setSelectedCurvedId(null); }} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left ${selectedSystemId === id ? 'bg-violet-50 ring-1 ring-violet-300' : 'hover:bg-gray-50'}`}><span className="flex-1">{id === 'date' ? 'Date / time' : 'Serial number'}</span><span className="text-gray-400">{Math.round(systemPositions[id].x)}, {Math.round(systemPositions[id].y)}</span></button>)}</div>
            {contentLayers.find(l => l.id === selectedContentId) && (() => { const sel = contentLayers.find(l => l.id === selectedContentId)!; return <div className="border-t pt-2 space-y-2 text-xs text-gray-600"><label className="block">Name<input value={sel.name} onChange={e => updateContent(sel.id, { name: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" /></label>{sel.type === 'text' ? <label className="block">Text<input value={sel.content || ''} onChange={e => updateContent(sel.id, { content: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5" /></label> : <label className="block">Asset<select value={sel.assetId || ''} onChange={e => updateContent(sel.id, { assetId: e.target.value })} className="mt-1 w-full border rounded px-2 py-1.5"><option value="">Select uploaded emblem</option>{assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}<div className="grid grid-cols-2 gap-2"><label>X<input type="number" value={sel.x} onChange={e => updateContent(sel.id, { x: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Y<input type="number" value={sel.y} onChange={e => updateContent(sel.id, { y: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Width<input type="number" min={10} value={sel.width} onChange={e => updateContent(sel.id, { width: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Height<input type="number" min={10} value={sel.height} onChange={e => updateContent(sel.id, { height: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label></div>{sel.type === 'text' && <div className="grid grid-cols-2 gap-2"><label>Font size<input type="number" min={6} value={sel.fontSize} onChange={e => updateContent(sel.id, { fontSize: Number(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label><label>Align<select value={sel.align} onChange={e => updateContent(sel.id, { align: e.target.value as ContentLayer['align'] })} className="mt-1 w-full border rounded px-2 py-1"><option value="start">Left</option><option value="middle">Center</option><option value="end">Right</option></select></label></div>}</div>; })()}
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
             <span className="text-[11px] text-gray-400 ml-2">Select any text, emblem, or shape, then drag it on the canvas to position it.</span>
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
            {listError && <p className="mt-2 text-[11px] text-red-600">{listError}</p>}
            <ul className="mt-2 divide-y divide-gray-100">
              {templates.length === 0 && <li className="py-2 text-xs text-gray-400">None yet. Save your first stamp above.</li>}
              {templates.map(t => (
                <li key={t.id} className="py-2 flex items-center gap-2 text-xs">
                  <span className={`flex-1 truncate ${editingId === t.id ? 'text-violet-700 font-medium' : 'text-gray-700'}`}>{t.name}</span><span className={`text-[10px] rounded px-1.5 py-0.5 ${t.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{t.status || 'DRAFT'}</span>
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
