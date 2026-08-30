'use client';

import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { api } from '@/lib/api';

type Processing = { threshold: number; contrast: number; rotation: number; crop?: { left: number; top: number; width: number; height: number } };

export default function DigitalSignaturesPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [original, setOriginal] = useState('');
  const [processed, setProcessed] = useState('');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState<Processing>({ threshold: 245, contrast: 1, rotation: 0 });
  const [sourceSize, setSourceSize] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadImage = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('Use PNG, JPG/JPEG, or WebP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage('Signature images must be 5 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const value = String(reader.result);
      setOriginal(value);
      const probe = new Image(); probe.onload = () => setSourceSize({ width: probe.naturalWidth, height: probe.naturalHeight }); probe.src = value;
      setMessage('');
      await process(value, processing);
    };
    reader.readAsDataURL(file);
  };

  const process = async (image = original, options = processing) => {
    if (!image) return;
    setBusy(true);
    try {
      const result = await api.post('/template-builder/signatures/preview', { image, ...options });
      setProcessed(result.data?.transparentImage || result.data?.processedImage || '');
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not extract handwriting'); }
    finally { setBusy(false); }
  };

  const adjust = (change: Partial<Processing>) => {
    const next = { ...processing, ...change };
    setProcessing(next);
    void process(original, next);
  };

  const save = async () => {
    if (!name.trim() || !original || !processed) { setMessage('Add an image, process it, and enter a name first.'); return; }
    setBusy(true);
    try {
      await api.post('/template-builder/signatures', { name: name.trim(), imageUrl: original, processing });
      setMessage('Signature saved as a transparent digital asset.');
      setName('');
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not save signature'); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
    <div className="max-w-6xl mx-auto">
      <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Signature Designer</p>
      <h1 className="text-3xl font-semibold mt-2">Extract the handwriting, not the paper</h1>
      <p className="text-slate-400 mt-2 max-w-2xl">Write on clean white paper with a dark pen. Use good lighting, avoid shadows, folds, and creases, and keep the complete signature visible.</p>

      <section className="grid lg:grid-cols-[0.8fr_1.2fr] gap-5 mt-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h2 className="font-medium">1. Upload</h2>
          <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void loadImage(e.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()} className="border border-dashed border-cyan-700 rounded-xl p-8 text-center cursor-pointer hover:bg-slate-800">
            <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => void loadImage(e.target.files?.[0])} />
            <div className="text-cyan-300 text-lg">Drop a scanned signature here</div><div className="text-xs text-slate-500 mt-2">or browse PNG, JPG, or WebP</div>
          </div>
          <h2 className="font-medium pt-2">2. Adjust extraction</h2>
          {original && sourceSize.width > 0 && <div className="text-xs text-slate-400">Drag over the original preview to crop. <button onClick={() => adjust({ crop: undefined })} className="text-cyan-300">Reset crop</button></div>}
          <label className="block text-xs text-slate-400">Background threshold: {processing.threshold}<input className="w-full" type="range" min="180" max="254" value={processing.threshold} onChange={e => adjust({ threshold: Number(e.target.value) })} /></label>
          <label className="block text-xs text-slate-400">Contrast: {processing.contrast.toFixed(1)}<input className="w-full" type="range" min="0.5" max="2" step="0.1" value={processing.contrast} onChange={e => adjust({ contrast: Number(e.target.value) })} /></label>
          <label className="block text-xs text-slate-400">Rotation: {processing.rotation}°<input className="w-full" type="range" min="-15" max="15" value={processing.rotation} onChange={e => adjust({ rotation: Number(e.target.value) })} /></label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Signature name" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
          <button disabled={busy} onClick={save} className="w-full rounded-lg bg-cyan-500 text-slate-950 py-2.5 font-semibold disabled:opacity-50">{busy ? 'Processing…' : 'Save Signature'}</button>
          {message && <p className="text-xs text-cyan-200">{message}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <CropPreview title="Before · original (drag to crop)" image={original} sourceSize={sourceSize} onCrop={crop => adjust({ crop })} />
          <Preview title="After · extracted transparent asset" image={processed} transparent />
        </div>
      </section>
    </div>
  </main>;
}

function Preview({ title, image, transparent }: { title: string; image: string; transparent?: boolean }) {
  return <div className={`rounded-2xl border border-slate-800 p-3 min-h-[280px] ${transparent ? 'bg-[linear-gradient(45deg,#273449_25%,transparent_25%,transparent_75%,#273449_75%),linear-gradient(45deg,#273449_25%,transparent_25%,transparent_75%,#273449_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px]' : 'bg-white'}`}><h2 className="text-xs text-slate-400 mb-3">{title}</h2>{image ? <img src={image} alt={title} className="w-full h-64 object-contain" /> : <div className="h-64 flex items-center justify-center text-slate-600 text-sm">Waiting for image</div>}</div>;
}

function CropPreview({ title, image, sourceSize, onCrop }: { title: string; image: string; sourceSize: { width: number; height: number }; onCrop: (crop: Processing['crop']) => void }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const point = (event: PointerEvent) => { const rect = imageRef.current?.getBoundingClientRect(); return rect ? { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) } : null; };
  const begin = (event: PointerEvent) => { const p = point(event); if (p) { event.currentTarget.setPointerCapture(event.pointerId); setStart(p); setSelection({ x: p.x, y: p.y, width: 0, height: 0 }); } };
  const move = (event: PointerEvent) => { if (!start) return; const p = point(event); if (!p) return; setSelection({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y) }); };
  const end = () => { if (selection && selection.width > 3 && selection.height > 3 && imageRef.current) { const rect = imageRef.current.getBoundingClientRect(); onCrop({ left: Math.round(selection.x / rect.width * sourceSize.width), top: Math.round(selection.y / rect.height * sourceSize.height), width: Math.max(1, Math.round(selection.width / rect.width * sourceSize.width)), height: Math.max(1, Math.round(selection.height / rect.height * sourceSize.height)) }); } setStart(null); };
  return <div className="rounded-2xl border border-slate-800 p-3 min-h-[280px] bg-white"><h2 className="text-xs text-slate-500 mb-3">{title}</h2>{image ? <div className="h-64 flex items-center justify-center select-none"><div className="relative inline-block max-w-full max-h-64" onPointerDown={begin} onPointerMove={move} onPointerUp={end}><img ref={imageRef} src={image} alt={title} className="max-w-full max-h-64 object-contain pointer-events-none" />{selection && <div className="absolute border-2 border-cyan-400 bg-cyan-400/20 pointer-events-none" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}</div></div> : <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Waiting for image</div>}</div>;
}
