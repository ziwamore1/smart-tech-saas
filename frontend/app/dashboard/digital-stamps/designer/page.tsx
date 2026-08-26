'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { stampEngineApi } from '@/lib/api';

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
  autoFit?: boolean;
  separator?: string;
  direction?: 'horizontal' | 'vertical';
  assetId?: string; width?: number; height?: number;
  showTime?: boolean; label?: string;
}

interface TemplateRow {
  id: string; name: string; status: string; version: number; isDefault: boolean; updatedAt: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const CANVAS = 600;

/**
 * Calculate the maximum font size that fits the full text on a curved arc.
 * Uses the SVG arc length and a per-character width estimate that accounts
 * for font family, weight and letter-spacing.
 */
function fitCurvedTextToArc(
  content: string,
  fontSize: number,
  letterSpacing: number,
  fontFamily: string,
  fontWeight: string,
  curveRadius: number,
  startAngle: number,
  endAngle: number,
): number {
  if (!content) return fontSize;
  const arcLength = curveRadius * Math.abs(endAngle - startAngle) * (Math.PI / 180);
  // Character width factor: bold serif is widest, sans is slightly narrower
  const isSerif = fontFamily.toLowerCase().includes('serif');
  const isBold = fontWeight === 'bold';
  const charWidthFactor = isSerif ? (isBold ? 0.60 : 0.55) : (isBold ? 0.54 : 0.50);
  const charCount = content.length;
  // Total text width = sum of (charWidth * fontSize) + (charCount - 1) * letterSpacing
  const textWidth = charCount * charWidthFactor * fontSize + (charCount - 1) * letterSpacing;
  if (textWidth <= arcLength) return fontSize; // already fits
  // Solve for the font size that makes textWidth == arcLength
  const optimal = (arcLength - (charCount - 1) * letterSpacing) / (charCount * charWidthFactor);
  return Math.max(8, Math.floor(optimal));
}

const defaultLayers = (): LayerDraft[] => ([
  { id: uid(), type: 'curved-text', name: 'Top arc — institution name', enabled: true, content: 'INSTITUTION NAME', x: 300, y: 120, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 40, fontWeight: 'bold', letterSpacing: 4, color: '#123456', curveRadius: 225, startAngle: -155, endAngle: -25 },
  { id: uid(), type: 'curved-text', name: 'Bottom arc — motto / office', enabled: true, content: 'OFFICIAL DOCUMENT', x: 300, y: 480, rotation: 0, opacity: 1, zIndex: 11, fontFamily: 'serif', fontSize: 30, fontWeight: 'bold', letterSpacing: 3, color: '#123456', curveRadius: 235, startAngle: 150, endAngle: 30 },
  { id: uid(), type: 'image', name: 'Center logo / emblem', enabled: false, x: 300, y: 255, rotation: 0, opacity: 1, zIndex: 20, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 130, height: 130 },
  { id: uid(), type: 'text', name: 'Department', enabled: true, content: 'DEPARTMENT OF EDUCATION', x: 300, y: 385, rotation: 0, opacity: 1, zIndex: 30, fontFamily: 'sans-serif', fontSize: 16, fontWeight: 'bold', letterSpacing: 2, color: '#1e3a5f' },
  { id: uid(), type: 'date', name: 'Stamp date (+ time)', enabled: true, label: 'DIGITALLY STAMPED', showTime: true, x: 300, y: 425, rotation: 0, opacity: 1, zIndex: 31, fontFamily: 'serif', fontSize: 14, fontWeight: 'bold', letterSpacing: 1, color: '#111827' },
  { id: uid(), type: 'serial', name: 'Serial number', enabled: true, label: '', x: 300, y: 458, rotation: 0, opacity: 1, zIndex: 32, fontFamily: 'monospace', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: '#374151' },
  { id: uid(), type: 'verification-marker', name: 'Verification check', enabled: false, x: 300, y: 520, rotation: 0, opacity: 1, zIndex: 33, fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#15803d', label: 'VERIFIED DIGITALLY', width: 34, height: 34 },
]);

const rectangularStampLayers = (): LayerDraft[] => ([
  { id: uid(), type: 'text', name: 'Institution name', enabled: true, content: 'INSTITUTION NAME', x: 300, y: 100, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 24, fontWeight: 'bold', letterSpacing: 3, color: '#123456', direction: 'horizontal' },
  { id: uid(), type: 'image', name: 'Left logo', enabled: false, x: 145, y: 280, rotation: 0, opacity: 1, zIndex: 15, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 70, height: 70 },
  { id: uid(), type: 'image', name: 'Right logo', enabled: false, x: 455, y: 280, rotation: 0, opacity: 1, zIndex: 16, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 70, height: 70 },
  { id: uid(), type: 'date', name: 'Stamp date (+ time)', enabled: true, label: 'DIGITALLY STAMPED', showTime: true, x: 300, y: 290, rotation: 0, opacity: 1, zIndex: 20, fontFamily: 'serif', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: '#111827' },
  { id: uid(), type: 'text', name: 'Department', enabled: true, content: 'DEPARTMENT OF EDUCATION', x: 300, y: 420, rotation: 0, opacity: 1, zIndex: 30, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, color: '#1e3a5f', direction: 'horizontal' },
  { id: uid(), type: 'text', name: 'Address', enabled: true, content: 'P.O. Box 1234, City', x: 300, y: 450, rotation: 0, opacity: 1, zIndex: 31, fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'normal', letterSpacing: 1, color: '#4b5563', direction: 'horizontal' },
  { id: uid(), type: 'serial', name: 'Serial number', enabled: true, label: '', x: 300, y: 475, rotation: 0, opacity: 1, zIndex: 32, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#374151' },
]);

const squareStampLayers = (): LayerDraft[] => ([
  { id: uid(), type: 'text', name: 'Institution name', enabled: true, content: 'INSTITUTION NAME', x: 300, y: 90, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 22, fontWeight: 'bold', letterSpacing: 3, color: '#123456', direction: 'horizontal' },
  { id: uid(), type: 'image', name: 'Left logo', enabled: false, x: 145, y: 300, rotation: 0, opacity: 1, zIndex: 15, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 65, height: 65 },
  { id: uid(), type: 'image', name: 'Right logo', enabled: false, x: 455, y: 300, rotation: 0, opacity: 1, zIndex: 16, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 65, height: 65 },
  { id: uid(), type: 'date', name: 'Stamp date (+ time)', enabled: true, label: 'DIGITALLY STAMPED', showTime: true, x: 300, y: 310, rotation: 0, opacity: 1, zIndex: 20, fontFamily: 'serif', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: '#111827' },
  { id: uid(), type: 'text', name: 'Department', enabled: true, content: 'DEPARTMENT OF EDUCATION', x: 300, y: 440, rotation: 0, opacity: 1, zIndex: 30, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, color: '#1e3a5f', direction: 'horizontal' },
  { id: uid(), type: 'text', name: 'Address', enabled: true, content: 'P.O. Box 1234, City', x: 300, y: 470, rotation: 0, opacity: 1, zIndex: 31, fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'normal', letterSpacing: 1, color: '#4b5563', direction: 'horizontal' },
  { id: uid(), type: 'serial', name: 'Serial number', enabled: true, label: '', x: 300, y: 495, rotation: 0, opacity: 1, zIndex: 32, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#374151' },
]);

const ovalStampLayers = (): LayerDraft[] => ([
  { id: uid(), type: 'curved-text', name: 'Top arc — institution name', enabled: true, content: 'INSTITUTION NAME', x: 300, y: 110, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 32, fontWeight: 'bold', letterSpacing: 4, color: '#123456', curveRadius: 230, startAngle: -150, endAngle: -30 },
  { id: uid(), type: 'image', name: 'Left logo', enabled: false, x: 130, y: 300, rotation: 0, opacity: 1, zIndex: 15, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 60, height: 60 },
  { id: uid(), type: 'image', name: 'Right logo', enabled: false, x: 470, y: 300, rotation: 0, opacity: 1, zIndex: 16, fontFamily: 'serif', fontSize: 12, fontWeight: 'normal', letterSpacing: 0, color: '#123456', assetId: '', width: 60, height: 60 },
  { id: uid(), type: 'date', name: 'Stamp date (+ time)', enabled: true, label: 'DIGITALLY STAMPED', showTime: true, x: 300, y: 300, rotation: 0, opacity: 1, zIndex: 20, fontFamily: 'serif', fontSize: 13, fontWeight: 'bold', letterSpacing: 1, color: '#111827' },
  { id: uid(), type: 'text', name: 'Department', enabled: true, content: 'DEPARTMENT OF EDUCATION', x: 300, y: 420, rotation: 0, opacity: 1, zIndex: 30, fontFamily: 'sans-serif', fontSize: 14, fontWeight: 'bold', letterSpacing: 2, color: '#1e3a5f', direction: 'horizontal' },
  { id: uid(), type: 'text', name: 'Address', enabled: true, content: 'P.O. Box 1234, City', x: 300, y: 450, rotation: 0, opacity: 1, zIndex: 31, fontFamily: 'sans-serif', fontSize: 11, fontWeight: 'normal', letterSpacing: 1, color: '#4b5563', direction: 'horizontal' },
  { id: uid(), type: 'serial', name: 'Serial number', enabled: true, label: '', x: 300, y: 475, rotation: 0, opacity: 1, zIndex: 32, fontFamily: 'monospace', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, color: '#374151' },
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
  const [noiseAmount, setNoiseAmount] = useState(0.18);
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

  // ── Shape sizing ──
  const [outerRadius, setOuterRadius] = useState(280);
  const [shapeWidth, setShapeWidth] = useState(560);
  const [shapeHeight, setShapeHeight] = useState(560);
  const [innerRingRadius, setInnerRingRadius] = useState(238);
  const [innerInset, setInnerInset] = useState(22);
  const [innerScale, setInnerScale] = useState(100);

  // ── Drag state ──
  const previewRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, layerX: 0, layerY: 0 });
  const [dragging, setDragging] = useState(false);

  // ── Shape resize state ──
  const isResizing = useRef(false);
  const resizeHandleRef = useRef<string>('');
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, w: 0, h: 0, innerVal: 0 });

  const debounceRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const renderFailures = useRef(0);

  const notify = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Sync shape dimensions when shape type changes ──
  useEffect(() => {
    if (shapeType === 'circle') {
      setShapeWidth(outerRadius * 2);
      setShapeHeight(outerRadius * 2);
    } else {
      const w = outerRadius * 2;
      setShapeWidth(w);
      setShapeHeight(shapeType === 'square' ? w : w);
    }
  }, [shapeType]);

  const configJson = useMemo(() => ({
    canvas: { width: CANVAS, height: CANVAS, background: 'transparent' },
    shape: {
      type: shapeType,
      outerRadius: shapeType === 'circle' ? outerRadius : undefined,
      width: shapeType !== 'circle' ? shapeWidth : undefined,
      height: shapeType !== 'circle' ? shapeHeight : undefined,
      borderWidth, borderColor, borderCount,
      innerRings: innerRing
         ? [{ radius: shapeType === 'circle' ? innerRingRadius : undefined, inset: shapeType !== 'circle' ? innerInset : undefined, scale: innerScale, width: 2, color: borderColor, dashed: innerRingDashed }]
        : [],
    },
    layers: layers
      .filter(l => l.enabled)
      .map(l => {
        const cx = CANVAS / 2;
        const cy = CANVAS / 2;
        if (l.type === 'curved-text') {
          return { id: l.id, type: l.type, name: l.name, content: l.content || '', x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, fontFamily: l.fontFamily, fontSize: l.fontSize, fontWeight: l.fontWeight, letterSpacing: l.letterSpacing, color: l.color, separator: l.separator || undefined,
            curve: { centerX: cx, centerY: cy, radius: l.curveRadius ?? 225, startAngle: l.startAngle ?? -150, endAngle: l.endAngle ?? -30, orientation: (l.startAngle ?? 0) > 90 ? 'inward' : 'outward' } };
        }
        if (l.type === 'image') {
          return { id: l.id, type: l.type, name: l.name, x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, assetId: l.assetId || undefined, width: l.width ?? 130, height: l.height ?? 130 };
        }
        if (l.type === 'verification-marker') {
          return { id: l.id, type: l.type, name: l.name, x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, text: l.label || undefined, size: 36, fontSize: l.fontSize };
        }
        return { id: l.id, type: l.type, name: l.name, content: l.content || '', x: l.x, y: l.y, rotation: l.rotation, opacity: l.opacity, zIndex: l.zIndex, fontFamily: l.fontFamily, fontSize: l.fontSize, fontWeight: l.fontWeight, letterSpacing: l.letterSpacing, color: l.color, label: l.label || undefined, showTime: l.showTime, direction: l.direction || undefined };
      }),
    effects: { inkOpacity, texture: noiseAmount > 0 ? 'ink' : 'none', watermarkText: watermarkText || undefined, noiseAmount },
  }), [shapeType, outerRadius, shapeWidth, shapeHeight, innerRingRadius, innerInset, innerScale, borderWidth, borderColor, borderCount, innerRing, innerRingDashed, inkOpacity, noiseAmount, watermarkText, layers]);

  const assetIds = useMemo(() => layers.filter(l => l.enabled && l.type === 'image' && l.assetId).map(l => l.assetId as string), [layers]);

  // ── Auto-fit curved text font size when autoFit is enabled ──
  useEffect(() => {
    let changed = false;
    const next = layers.map(l => {
      if (l.type !== 'curved-text' || !l.autoFit || !l.content) return l;
      const optimal = fitCurvedTextToArc(
        l.content, l.fontSize, l.letterSpacing, l.fontFamily, l.fontWeight,
        l.curveRadius ?? 225, l.startAngle ?? -150, l.endAngle ?? -30,
      );
      if (optimal !== l.fontSize) { changed = true; return { ...l, fontSize: optimal }; }
      return l;
    });
    if (changed) setLayers(next);
  }, [layers]);

  // ── Debounced server-rendered live preview with retry ──
  useEffect(() => {
    mountedRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const res = await stampEngineApi.renderPreview(configJson, assetIds);
        if (mountedRef.current) {
          setSvg(res.data.svg);
          renderFailures.current = 0;
        }
      } catch {
        if (mountedRef.current && renderFailures.current < 3) {
          renderFailures.current++;
          const retryDelay = renderFailures.current * 500;
          debounceRef.current = setTimeout(async () => {
            if (!mountedRef.current) return;
            try {
              const res = await stampEngineApi.renderPreview(configJson, assetIds);
              if (mountedRef.current) {
                setSvg(res.data.svg);
                renderFailures.current = 0;
              }
            } catch { /* give up after retries */ }
          }, retryDelay);
        }
      }
    }, 300);
    return () => {
      mountedRef.current = false;
      clearTimeout(debounceRef.current);
    };
  }, [configJson, assetIds]);

  // ── Unmount cleanup ──
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loadLists = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([stampEngineApi.listTemplates(), stampEngineApi.listAssets()]);
      if (mountedRef.current) {
        setTemplates(t.data.templates || []);
        setAssets(a.data.assets || []);
      }
    } catch { /* gated tiers */ }
  }, []);

  useEffect(() => { loadLists(); }, [loadLists]);

  const updateLayer = (id: string, patch: Partial<LayerDraft>) =>
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)));

  // ── Drag-to-position handlers ──
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const el = previewRef.current;
    if (!el) return { cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = CANVAS / rect.width;
    const scaleY = CANVAS / rect.height;
    return {
      cx: (e.clientX - rect.left) * scaleX,
      cy: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const handlePreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedId || busy) return;
    e.preventDefault();
    const coords = getCanvasCoords(e);
    const layer = layers.find(l => l.id === selectedId);
    if (!layer) return;
    isDragging.current = true;
    setDragging(true);
    dragStart.current = { x: coords.cx, y: coords.cy, layerX: layer.x, layerY: layer.y };
  }, [selectedId, layers, busy, getCanvasCoords]);

  const handlePreviewMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !selectedId) return;
    const coords = getCanvasCoords(e);
    const dx = coords.cx - dragStart.current.x;
    const dy = coords.cy - dragStart.current.y;
    const newX = Math.round(dragStart.current.layerX + dx);
    const newY = Math.round(dragStart.current.layerY + dy);
    updateLayer(selectedId, { x: Math.max(0, Math.min(CANVAS, newX)), y: Math.max(0, Math.min(CANVAS, newY)) });
  }, [selectedId, getCanvasCoords]);

  const handlePreviewMouseUp = useCallback(() => {
    isDragging.current = false;
    isResizing.current = false;
    resizeHandleRef.current = '';
    setDragging(false);
  }, []);

  // ── Shape resize handlers ──
  const handleResizeStart = useCallback((handle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeHandleRef.current = handle;
    const innerVal = handle.startsWith('i-')
      ? (shapeType === 'circle' ? innerRingRadius : innerInset)
      : 0;
    resizeStart.current = { mouseX: e.clientX, mouseY: e.clientY, w: shapeWidth, h: shapeHeight, innerVal };
  }, [shapeType, shapeWidth, shapeHeight, innerRingRadius, innerInset]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current || !previewRef.current) return;
      const rect = previewRef.current.getBoundingClientRect();
      const scaleX = CANVAS / rect.width;
      const scaleY = CANVAS / rect.height;
      const dx = (e.clientX - resizeStart.current.mouseX) * scaleX;
      const dy = (e.clientY - resizeStart.current.mouseY) * scaleY;
      const h = resizeHandleRef.current;
      const isInner = h.startsWith('i-');
      const handle = h.replace(/^i-/, '');

      if (shapeType === 'circle') {
        if (isInner) {
          let newR = resizeStart.current.innerVal;
          if (handle.includes('r') || handle === 'right') newR = resizeStart.current.innerVal + dx;
          if (handle.includes('l') || handle === 'left') newR = resizeStart.current.innerVal - dx;
          if (handle.includes('b') || handle === 'bottom') newR = resizeStart.current.innerVal + dy;
          if (handle.includes('t') || handle === 'top') newR = resizeStart.current.innerVal - dy;
          if (handle.length === 2) newR = resizeStart.current.innerVal + (dx + dy) / 2;
          setInnerRingRadius(Math.round(Math.max(40, Math.min(outerRadius - 10, newR))));
        } else {
          let newR = outerRadius;
          if (handle.includes('r') || handle === 'right') newR = resizeStart.current.w / 2 + dx;
          if (handle.includes('l') || handle === 'left') newR = resizeStart.current.w / 2 - dx;
          if (handle.includes('b') || handle === 'bottom') newR = resizeStart.current.h / 2 + dy;
          if (handle.includes('t') || handle === 'top') newR = resizeStart.current.h / 2 - dy;
          if (handle.length === 2) newR = resizeStart.current.w / 2 + (dx + dy) / 2;
          const clamped = Math.round(Math.max(80, Math.min(290, newR)));
          setOuterRadius(clamped);
          setShapeWidth(clamped * 2);
          setShapeHeight(clamped * 2);
        }
      } else {
        if (isInner) {
          let newInset = resizeStart.current.innerVal;
          if (handle === 'left') newInset = resizeStart.current.innerVal + dx;
          if (handle === 'right') newInset = resizeStart.current.innerVal - dx;
          if (handle === 'top') newInset = resizeStart.current.innerVal + dy;
          if (handle === 'bottom') newInset = resizeStart.current.innerVal - dy;
          if (handle.length === 2) newInset = resizeStart.current.innerVal + (dx + dy) / 2;
          const maxInset = Math.floor(Math.min(shapeWidth, shapeHeight) / 2) - 2;
          setInnerInset(Math.round(Math.max(0, Math.min(maxInset, newInset))));
        } else {
          let newW = shapeWidth;
          let newH = shapeHeight;
          if (handle.includes('r') || handle === 'right') newW = resizeStart.current.w + dx * 2;
          if (handle.includes('l') || handle === 'left') newW = resizeStart.current.w - dx * 2;
          if (handle.includes('b') || handle === 'bottom') newH = resizeStart.current.h + dy * 2;
          if (handle.includes('t') || handle === 'top') newH = resizeStart.current.h - dy * 2;
          if (handle.length === 2) {
            newW = resizeStart.current.w + dx * 2;
            newH = resizeStart.current.h + dy * 2;
          }
          setShapeWidth(Math.round(Math.max(100, Math.min(580, newW)) / 2) * 2);
          setShapeHeight(Math.round(Math.max(100, Math.min(580, newH)) / 2) * 2);
        }
      }
    };
    const onUp = () => { isResizing.current = false; resizeHandleRef.current = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [shapeWidth, shapeHeight, shapeType, outerRadius, innerRingRadius, innerInset]);

  // ── Keyboard nudge ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const step = e.shiftKey ? 10 : 1;
      const layer = layers.find(l => l.id === selectedId);
      if (!layer) return;
      switch (e.key) {
        case 'ArrowLeft': e.preventDefault(); updateLayer(selectedId, { x: Math.max(0, layer.x - step) }); break;
        case 'ArrowRight': e.preventDefault(); updateLayer(selectedId, { x: Math.min(CANVAS, layer.x + step) }); break;
        case 'ArrowUp': e.preventDefault(); updateLayer(selectedId, { y: Math.max(0, layer.y - step) }); break;
        case 'ArrowDown': e.preventDefault(); updateLayer(selectedId, { y: Math.min(CANVAS, layer.y + step) }); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, layers]);

  // ── Alignment helpers ──
  const alignLayer = (axis: 'cx' | 'cy' | 'left' | 'right' | 'top' | 'bottom') => {
    if (!selectedId) return;
    const layer = layers.find(l => l.id === selectedId);
    if (!layer) return;
    switch (axis) {
      case 'cx': updateLayer(selectedId, { x: CANVAS / 2 }); break;
      case 'cy': updateLayer(selectedId, { y: CANVAS / 2 }); break;
      case 'left': updateLayer(selectedId, { x: 20 }); break;
      case 'right': updateLayer(selectedId, { x: CANVAS - 20 }); break;
      case 'top': updateLayer(selectedId, { y: 20 }); break;
      case 'bottom': updateLayer(selectedId, { y: CANVAS - 20 }); break;
    }
  };

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
      const draft = templates.find(t => t.name === name && t.status === 'DRAFT') as any;
      const published = templates.find(t => t.name === name && t.status === 'PUBLISHED') as any;

      let templateId: string | null = draft?.id || null;

      if (publish && published) {
        templateId = published.id;
        await stampEngineApi.updateTemplate(templateId, { configJson });
        await stampEngineApi.publishTemplate(templateId, 'Updated from designer');
      } else if (templateId) {
        await stampEngineApi.updateTemplate(templateId, { configJson });
        if (publish) {
          await stampEngineApi.publishTemplate(templateId, 'Published from designer');
        }
      } else {
        const res = await stampEngineApi.createTemplate({ name, configJson });
        templateId = res.data.id;
        if (publish) {
          await stampEngineApi.publishTemplate(templateId, 'Published from designer');
        }
      }
      await loadLists();
      // Refresh the preview after save so the displayed SVG keeps the current effects.
      try {
        const preview = await stampEngineApi.renderPreview(configJson, assetIds);
        if (mountedRef.current) setSvg(preview.data.svg);
      } catch { /* the existing preview remains visible if refresh fails */ }
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
    setOuterRadius(shape.outerRadius ?? 280);
    setShapeWidth(shape.width ?? 560);
    setShapeHeight(shape.height ?? 560);
    setInnerRingRadius(ring?.radius ?? 238);
    setInnerInset(ring?.inset ?? 22);
    setInnerScale(ring?.scale ?? 100);
    setInkOpacity(effects.inkOpacity ?? 0.92);
    setNoiseAmount(effects.noiseAmount ?? 0.18);
    setWatermarkText(effects.watermarkText || '');
    setLayers(cfg.layers.map((l: any): LayerDraft => ({
      id: l.id || uid(), type: l.type, name: l.name || l.type, enabled: true,
      content: l.content, x: l.x ?? 300, y: l.y ?? 300, rotation: l.rotation ?? 0,
      opacity: l.opacity ?? 1, zIndex: l.zIndex ?? 10,
      fontFamily: l.fontFamily || 'serif', fontSize: l.fontSize ?? 14,
      fontWeight: l.fontWeight || 'normal', letterSpacing: l.letterSpacing ?? 0,
      color: l.color || '#123456',
      curveRadius: l.curve?.radius, startAngle: l.curve?.startAngle, endAngle: l.curve?.endAngle,
      separator: l.separator || undefined,
      direction: l.direction || undefined,
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
    <div className="p-6 max-w-[1600px] mx-auto">
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

      <div className="flex gap-6 items-start">
        {/* ── Left: Controls ── */}
        <div className="w-[340px] shrink-0 space-y-4">
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
              <label className="block text-xs font-medium text-gray-600">Ink texture
                <div className="flex items-center gap-2 mt-1">
                  <input type="range" min={0} max={1} step={0.05} value={noiseAmount}
                    onChange={e => setNoiseAmount(parseFloat(e.target.value))}
                    className="flex-1" />
                  <span className="text-xs text-gray-500 w-10 text-right">{noiseAmount > 0 ? `${Math.round(noiseAmount * 100)}%` : 'Off'}</span>
                </div>
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
            </div>
            <label className="block text-xs font-medium text-gray-600">Watermark (optional)
              <input value={watermarkText} onChange={e => setWatermarkText(e.target.value)} placeholder="e.g. SPECIMEN" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-2">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Presets</h2>
            <button
              onClick={() => {
                setShapeType('rectangle');
                setShapeWidth(560);
                setShapeHeight(400);
                setBorderWidth(4);
                setBorderCount(1);
                setInnerRing(true);
                setInnerRingDashed(false);
                setInnerInset(60);
                setLayers(rectangularStampLayers());
                setSelectedId(null);
                notify('ok', 'Loaded rectangular stamp preset');
              }}
              className="w-full text-left px-3 py-2 text-xs border rounded-lg hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">Rectangular Stamp</span>
              <span className="block text-gray-400 mt-0.5">Outer + inner rectangle, institution, department, logos</span>
            </button>
            <button
              onClick={() => {
                setShapeType('square');
                setShapeWidth(500);
                setShapeHeight(500);
                setBorderWidth(4);
                setBorderCount(1);
                setInnerRing(true);
                setInnerRingDashed(false);
                setInnerInset(55);
                setLayers(squareStampLayers());
                setSelectedId(null);
                notify('ok', 'Loaded square stamp preset');
              }}
              className="w-full text-left px-3 py-2 text-xs border rounded-lg hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">Square Stamp</span>
              <span className="block text-gray-400 mt-0.5">Outer + inner square, institution, department, logos</span>
            </button>
            <button
              onClick={() => {
                setShapeType('oval');
                setShapeWidth(560);
                setShapeHeight(400);
                setBorderWidth(4);
                setBorderCount(1);
                setInnerRing(true);
                setInnerRingDashed(false);
                setInnerInset(50);
                setLayers(ovalStampLayers());
                setSelectedId(null);
                notify('ok', 'Loaded oval stamp preset');
              }}
              className="w-full text-left px-3 py-2 text-xs border rounded-lg hover:bg-gray-50"
            >
              <span className="font-medium text-gray-800">Oval Stamp</span>
              <span className="block text-gray-400 mt-0.5">Outer oval, curved top text, inner oval, department</span>
            </button>
          </section>

          {/* ── Shape sizing ── */}
          <section className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Shape Size</h2>
            {shapeType === 'circle' ? (
              <>
                <label className="block text-xs font-medium text-gray-600">Outer radius
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={80} max={290} step={1} value={outerRadius}
                      onChange={e => { const v = parseInt(e.target.value); setOuterRadius(v); setShapeWidth(v * 2); setShapeHeight(v * 2); }}
                      className="flex-1" />
                    <span className="text-xs text-gray-500 w-10 text-right">{outerRadius}</span>
                  </div>
                </label>
                <label className="block text-xs font-medium text-gray-600">Inner ring radius
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={60} max={outerRadius - 10} step={1} value={innerRingRadius}
                      onChange={e => setInnerRingRadius(parseInt(e.target.value))}
                      className="flex-1" />
                    <span className="text-xs text-gray-500 w-10 text-right">{innerRingRadius}</span>
                  </div>
                </label>
              </>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-600">Width
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={100} max={580} step={2} value={shapeWidth}
                      onChange={e => setShapeWidth(parseInt(e.target.value))}
                      className="flex-1" />
                    <span className="text-xs text-gray-500 w-10 text-right">{shapeWidth}</span>
                  </div>
                </label>
                <label className="block text-xs font-medium text-gray-600">Height
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={100} max={580} step={2} value={shapeHeight}
                      onChange={e => setShapeHeight(parseInt(e.target.value))}
                      className="flex-1" />
                    <span className="text-xs text-gray-500 w-10 text-right">{shapeHeight}</span>
                  </div>
                </label>
                <label className="block text-xs font-medium text-gray-600">Inner inset
                  <div className="flex items-center gap-2 mt-1">
                    <input type="range" min={0} max={Math.floor(Math.min(shapeWidth, shapeHeight) / 2) - 2} step={1} value={innerInset}
                      onChange={e => setInnerInset(parseInt(e.target.value))}
                      className="flex-1" />
                    <span className="text-xs text-gray-500 w-10 text-right">{innerInset}</span>
                  </div>
                </label>
              </>
            )}
            <label className="block text-xs font-medium text-gray-600">Inner shape scale
              <div className="flex items-center gap-2 mt-1">
                <input type="range" min={10} max={100} step={1} value={innerScale}
                  onChange={e => setInnerScale(parseInt(e.target.value))}
                  className="flex-1" />
                <span className="text-xs text-gray-500 w-10 text-right">{innerScale}%</span>
              </div>
            </label>
          </section>

          <section className="bg-white rounded-xl border p-4 space-y-2">
            <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Logo / Emblem</h2>
            <input type="file" accept=".png,.svg,.webp" onChange={e => handleUploadAsset(e.target.files?.[0] as File)} className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700" />
            <p className="text-[11px] text-gray-400">PNG / SVG / WebP · transparency preserved · upload only assets your institution is authorised to use.</p>
            {assets.length > 0 && layers.filter(l => l.type === 'image').map(imgLayer => (
              <div key={imgLayer.id} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 w-16 shrink-0 truncate">{imgLayer.name}</span>
                <select
                  value={imgLayer.assetId || ''}
                  onChange={e => updateLayer(imgLayer.id, { assetId: e.target.value, enabled: Boolean(e.target.value) })}
                  className="flex-1 border rounded-lg px-2 py-1.5 text-xs"
                >
                  <option value="">— None —</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Layers</h2>
              <div className="relative group">
                <button className="px-2 py-1 text-[10px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Add Text</button>
                <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 whitespace-nowrap">
                  <button onClick={() => {
                    const id = uid();
                    const newLayer: LayerDraft = { id, type: 'text', name: 'Custom text', enabled: true, content: 'CUSTOM TEXT', x: 300, y: 300, rotation: 0, opacity: 1, zIndex: 40 + layers.length, fontFamily: 'serif', fontSize: 20, fontWeight: 'bold', letterSpacing: 2, color: '#123456', direction: 'horizontal' };
                    setLayers(prev => [...prev, newLayer]);
                    setSelectedId(id);
                  }} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded-t-lg">Horizontal</button>
                  <button onClick={() => {
                    const id = uid();
                    const newLayer: LayerDraft = { id, type: 'text', name: 'Vertical text', enabled: true, content: 'VERTICAL', x: 300, y: 300, rotation: 0, opacity: 1, zIndex: 40 + layers.length, fontFamily: 'serif', fontSize: 20, fontWeight: 'bold', letterSpacing: 2, color: '#123456', direction: 'vertical' };
                    setLayers(prev => [...prev, newLayer]);
                    setSelectedId(id);
                  }} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50">Vertical</button>
                  <button onClick={() => {
                    const id = uid();
                    const newLayer: LayerDraft = { id, type: 'curved-text', name: 'Curved text', enabled: true, content: 'CURVED TEXT', x: 300, y: 120, rotation: 0, opacity: 1, zIndex: 40 + layers.length, fontFamily: 'serif', fontSize: 28, fontWeight: 'bold', letterSpacing: 2, color: '#123456', curveRadius: 200, startAngle: -150, endAngle: -30 };
                    setLayers(prev => [...prev, newLayer]);
                    setSelectedId(id);
                  }} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 rounded-b-lg">Curved</button>
                </div>
              </div>
            </div>
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
                  {selected.type === 'text' && (
                    <label className="block text-xs font-medium text-gray-600">Direction
                      <select value={selected.direction || 'horizontal'} onChange={e => updateLayer(selected.id, { direction: e.target.value as 'horizontal' | 'vertical' })} className="mt-1 w-full border rounded-lg px-2 py-1.5 text-sm">
                        <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
                      </select>
                    </label>
                  )}
                  {selected.type === 'curved-text' && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-xs text-gray-600">Radius<input type="number" value={selected.curveRadius ?? 225} onChange={e => updateLayer(selected.id, { curveRadius: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
                        <label className="text-xs text-gray-600">Start°<input type="number" value={selected.startAngle ?? -150} onChange={e => updateLayer(selected.id, { startAngle: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
                        <label className="text-xs text-gray-600">End°<input type="number" value={selected.endAngle ?? -30} onChange={e => updateLayer(selected.id, { endAngle: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1 text-sm" /></label>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input type="checkbox" checked={Boolean(selected.autoFit)} onChange={e => updateLayer(selected.id, { autoFit: e.target.checked })} />
                          Auto-fit font size
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selected.content) return;
                            const optimal = fitCurvedTextToArc(
                              selected.content, selected.fontSize, selected.letterSpacing,
                              selected.fontFamily, selected.fontWeight,
                              selected.curveRadius ?? 225, selected.startAngle ?? -150, selected.endAngle ?? -30,
                            );
                            updateLayer(selected.id, { fontSize: optimal, autoFit: true });
                          }}
                          className="px-2 py-0.5 text-[10px] border rounded hover:bg-blue-50 text-blue-700"
                        >
                          Fit to arc
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 -mt-1">Shrinks font to fit full text on the arc while preserving letter-spacing.</p>
                      <label className="block text-xs font-medium text-gray-600 mt-1">Gap separator (e.g. ★)
                        <input value={selected.separator || ''} onChange={e => updateLayer(selected.id, { separator: e.target.value || undefined })} placeholder="★" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
                      </label>
                      <p className="text-[10px] text-gray-400 -mt-1">Places a character at the midpoint of the arc gap (where text doesn&apos;t cover).</p>
                    </>
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

              {/* Position & alignment */}
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <label>X<input type="number" value={selected.x} onChange={e => updateLayer(selected.id, { x: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                <label>Y<input type="number" value={selected.y} onChange={e => updateLayer(selected.id, { y: parseInt(e.target.value) })} className="mt-1 w-full border rounded px-2 py-1" /></label>
              </div>
              <div className="flex gap-1 flex-wrap">
                <button onClick={() => alignLayer('cx')} className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50" title="Center horizontally">⇔ Center</button>
                <button onClick={() => alignLayer('cy')} className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50" title="Center vertically">⇕ Center</button>
                <button onClick={() => alignLayer('left')} className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50">Left</button>
                <button onClick={() => alignLayer('right')} className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50">Right</button>
                <button onClick={() => alignLayer('top')} className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50">Top</button>
                <button onClick={() => alignLayer('bottom')} className="px-2 py-1 text-[10px] border rounded hover:bg-gray-50">Bottom</button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
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
              {selected.type === 'image' && (
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <label>Width<input type="number" min={10} max={300} value={selected.width ?? 130} onChange={e => updateLayer(selected.id, { width: parseInt(e.target.value) || 10 })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                  <label>Height<input type="number" min={10} max={300} value={selected.height ?? 130} onChange={e => updateLayer(selected.id, { height: parseInt(e.target.value) || 10 })} className="mt-1 w-full border rounded px-2 py-1" /></label>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── Center: Live preview ── */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Live Preview</h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Use arrow keys to nudge · Shift = 10px</span>
                <span className="text-[11px] px-2 py-0.5 bg-green-50 text-green-700 rounded-full">engine-rendered</span>
              </div>
            </div>
            <div
              ref={previewRef}
              className={`mx-auto rounded-lg select-none relative ${dragging ? 'cursor-grabbing' : selectedId ? 'cursor-grab' : 'cursor-crosshair'}`}
              style={{
                aspectRatio: '1 / 1',
                maxWidth: '100%',
                backgroundImage: 'linear-gradient(45deg,#f0f0f0 25%,transparent 25%),linear-gradient(-45deg,#f0f0f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#f0f0f0 75%),linear-gradient(-45deg,transparent 75%,#f0f0f0 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
              }}
              onMouseDown={handlePreviewMouseDown}
              onMouseMove={handlePreviewMouseMove}
              onMouseUp={handlePreviewMouseUp}
              onMouseLeave={handlePreviewMouseUp}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: svg || '<span style="color:#9ca3af;font-size:13px">Rendering…</span>' }}
              />
              {!selectedId && (() => {
                const isCircle = shapeType === 'circle';
                const oR = isCircle ? outerRadius : shapeWidth / 2;
                const oRB = isCircle ? outerRadius : shapeHeight / 2;
                const oL = ((300 - oR) / 600) * 100;
                const oT = ((300 - oRB) / 600) * 100;
                const oRr = ((300 + oR) / 600) * 100;
                const oB = ((300 + oRB) / 600) * 100;
                const iRad = isCircle ? innerRingRadius : 0;
                const iInset = isCircle ? 0 : innerInset;
                const iL = ((300 - (isCircle ? iRad : shapeWidth / 2 - iInset)) / 600) * 100;
                const iT = ((300 - (isCircle ? iRad : shapeHeight / 2 - iInset)) / 600) * 100;
                const iRr = ((300 + (isCircle ? iRad : shapeWidth / 2 - iInset)) / 600) * 100;
                const iB = ((300 + (isCircle ? iRad : shapeHeight / 2 - iInset)) / 600) * 100;
                const showInner = isCircle ? innerRing : true;
                return (
                  <>
                    {/* Outer handles (blue) */}
                    <div onMouseDown={e => handleResizeStart('left', e)} className="absolute cursor-ew-resize bg-blue-500/40 hover:bg-blue-500/80 rounded-full z-20" style={{ left: `${oL}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 40 }} />
                    <div onMouseDown={e => handleResizeStart('right', e)} className="absolute cursor-ew-resize bg-blue-500/40 hover:bg-blue-500/80 rounded-full z-20" style={{ left: `${oRr}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 40 }} />
                    <div onMouseDown={e => handleResizeStart('top', e)} className="absolute cursor-ns-resize bg-blue-500/40 hover:bg-blue-500/80 rounded-full z-20" style={{ top: `${oT}%`, left: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 10 }} />
                    <div onMouseDown={e => handleResizeStart('bottom', e)} className="absolute cursor-ns-resize bg-blue-500/40 hover:bg-blue-500/80 rounded-full z-20" style={{ top: `${oB}%`, left: '50%', transform: 'translate(-50%, -50%)', width: 40, height: 10 }} />
                    <div onMouseDown={e => handleResizeStart('tl', e)} className="absolute cursor-nwse-resize bg-blue-600/50 hover:bg-blue-600 rounded-full z-20" style={{ left: `${oL}%`, top: `${oT}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12 }} />
                    <div onMouseDown={e => handleResizeStart('tr', e)} className="absolute cursor-nesw-resize bg-blue-600/50 hover:bg-blue-600 rounded-full z-20" style={{ left: `${oRr}%`, top: `${oT}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12 }} />
                    <div onMouseDown={e => handleResizeStart('bl', e)} className="absolute cursor-nesw-resize bg-blue-600/50 hover:bg-blue-600 rounded-full z-20" style={{ left: `${oL}%`, top: `${oB}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12 }} />
                    <div onMouseDown={e => handleResizeStart('br', e)} className="absolute cursor-nwse-resize bg-blue-600/50 hover:bg-blue-600 rounded-full z-20" style={{ left: `${oRr}%`, top: `${oB}%`, transform: 'translate(-50%, -50%)', width: 12, height: 12 }} />
                    {/* Inner handles (orange) */}
                    {showInner && (
                      <>
                        <div onMouseDown={e => handleResizeStart('i-left', e)} className="absolute cursor-ew-resize bg-orange-500/40 hover:bg-orange-500/80 rounded-full z-20" style={{ left: `${iL}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 32 }} />
                        <div onMouseDown={e => handleResizeStart('i-right', e)} className="absolute cursor-ew-resize bg-orange-500/40 hover:bg-orange-500/80 rounded-full z-20" style={{ left: `${iRr}%`, top: '50%', transform: 'translate(-50%, -50%)', width: 10, height: 32 }} />
                        <div onMouseDown={e => handleResizeStart('i-top', e)} className="absolute cursor-ns-resize bg-orange-500/40 hover:bg-orange-500/80 rounded-full z-20" style={{ top: `${iT}%`, left: '50%', transform: 'translate(-50%, -50%)', width: 32, height: 10 }} />
                        <div onMouseDown={e => handleResizeStart('i-bottom', e)} className="absolute cursor-ns-resize bg-orange-500/40 hover:bg-orange-500/80 rounded-full z-20" style={{ top: `${iB}%`, left: '50%', transform: 'translate(-50%, -50%)', width: 32, height: 10 }} />
                        <div onMouseDown={e => handleResizeStart('i-tl', e)} className="absolute cursor-nwse-resize bg-orange-600/50 hover:bg-orange-600 rounded-full z-20" style={{ left: `${iL}%`, top: `${iT}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10 }} />
                        <div onMouseDown={e => handleResizeStart('i-tr', e)} className="absolute cursor-nesw-resize bg-orange-600/50 hover:bg-orange-600 rounded-full z-20" style={{ left: `${iRr}%`, top: `${iT}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10 }} />
                        <div onMouseDown={e => handleResizeStart('i-bl', e)} className="absolute cursor-nesw-resize bg-orange-600/50 hover:bg-orange-600 rounded-full z-20" style={{ left: `${iL}%`, top: `${iB}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10 }} />
                        <div onMouseDown={e => handleResizeStart('i-br', e)} className="absolute cursor-nwse-resize bg-orange-600/50 hover:bg-orange-600 rounded-full z-20" style={{ left: `${iRr}%`, top: `${iB}%`, transform: 'translate(-50%, -50%)', width: 10, height: 10 }} />
                      </>
                    )}
                  </>
                );
              })()}
            </div>
            <p className="text-[11px] text-gray-400 mt-3 text-center">
              Finalised documents receive the authoritative date/time and serial number from the server.
            </p>
          </div>
        </div>

        {/* ── Right: Templates + Security note ── */}
        <div className="w-[280px] shrink-0 space-y-3">
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
