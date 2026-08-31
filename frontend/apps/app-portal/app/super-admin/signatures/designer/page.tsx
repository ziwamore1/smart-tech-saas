'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { templateBuilderApi } from '@/lib/api';

const PREVIEW_EDGE = 1600;

async function prepareForUpload(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Could not read the uploaded image'));
    img.src = dataUrl;
  });
  const edge = Math.max(img.naturalWidth, img.naturalHeight);
  if (edge <= PREVIEW_EDGE) return dataUrl;
  const scale = PREVIEW_EDGE / edge;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export default function SuperAdminSignatureDesignerPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('');
  const [prepared, setPrepared] = useState('');
  const [result, setResult] = useState('');
  const [name, setName] = useState('');
  const [threshold, setThreshold] = useState(245);
  const [contrast, setContrast] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<Signature[]>([]);

  const loadSaved = useCallback(async () => {
    try {
      const response = await templateBuilderApi.getSignatures({ scope: 'PLATFORM' });
      const data = response.data?.data || response.data || [];
      setSaved(Array.isArray(data) ? data : []);
    } catch {
      // keep the current list on transient failures
    }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const process = async (image = prepared || source, options = { threshold, contrast, rotation }) => {
    if (!image) return;
    setBusy(true);
    setMessage('Extracting handwriting…');
    try {
      const response = await templateBuilderApi.previewSignature(image, options);
      const data = response.data?.data || response.data;
      const extracted = data?.transparentImage || data?.processedImage;
      if (!extracted) throw new Error('The server returned no extracted signature image.');
      setResult(extracted);
      setMessage('Handwriting extracted from the background.');
    } catch (error: any) { setMessage(error?.response?.data?.message || error?.message || 'Signature extraction failed'); }
    finally { setBusy(false); }
  };

  const choose = (file?: File) => {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('Choose a PNG, JPG/JPEG, or WebP image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage('The image must be 5 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setSource(value);
      setResult('');
      setPrepared('');
      setMessage('Preparing image…');
      void prepareForUpload(value)
        .then((ready) => { setPrepared(ready); setResult(''); setMessage('Image uploaded. Select Extract Signature to isolate the handwriting.'); })
        .catch((error: any) => setMessage(error?.message || 'Could not prepare the image.'));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!name.trim() || !source || !result) { setMessage('Upload, extract, and name the signature first.'); return; }
    setBusy(true);
    try {
      await templateBuilderApi.createSignature({ name: name.trim(), imageUrl: prepared || source, scope: 'PLATFORM', processing: { threshold, contrast, rotation } });
      setMessage('Platform signature saved. Schools can now use it in their templates.');
      setName('');
      void loadSaved();
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not save signature'); }
    finally { setBusy(false); }
  };

  const remove = async (id: string, signatureName: string) => {
    if (!window.confirm(`Delete platform signature "${signatureName}"?`)) return;
    setBusy(true);
    try { await templateBuilderApi.deleteSignature(id); setMessage('Signature deleted.'); void loadSaved(); }
    catch (error: any) { setMessage(error?.response?.data?.message || 'Could not delete signature'); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string, signatureName: string) => {
    const reason = window.prompt(`Reason for revoking "${signatureName}"?`);
    if (reason === null) return;
    setBusy(true);
    try { await templateBuilderApi.setSignatureStatus(id, 'REVOKED', reason || undefined); setMessage('Signature revoked.'); void loadSaved(); }
    catch (error: any) { setMessage(error?.response?.data?.message || 'Could not revoke signature'); }
    finally { setBusy(false); }
  };

  const restore = async (id: string, signatureName: string) => {
    if (!window.confirm(`Restore "${signatureName}" to active?`)) return;
    setBusy(true);
    try { await templateBuilderApi.setSignatureStatus(id, 'ACTIVE'); setMessage('Signature restored.'); void loadSaved(); }
    catch (error: any) { setMessage(error?.response?.data?.message || 'Could not restore signature'); }
    finally { setBusy(false); }
  };

  const update = (key: 'threshold' | 'contrast' | 'rotation', value: number) => {
    const next = { threshold, contrast, rotation, [key]: value };
    if (key === 'threshold') setThreshold(value); if (key === 'contrast') setContrast(value); if (key === 'rotation') setRotation(value);
    void process(prepared || source, next);
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Platform Signature Designer</h1>
      <p className="text-sm text-gray-500 mt-1">Create institution-level digital signatures that every school can use in templates and official documents. Revoking a signature immediately blocks it from new documents.</p>
    </div>
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">Use clean white paper, a dark pen, good lighting, and keep the complete signature visible. Avoid shadows, folds, and creases.</div>
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold">Upload and adjust</h2>
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); choose(e.dataTransfer.files[0]); }} onClick={() => fileRef.current?.click()} className="border border-dashed border-cyan-400 rounded-xl p-6 text-center cursor-pointer hover:bg-cyan-50"><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => choose(e.target.files?.[0])} /><span className="text-cyan-700 text-sm font-medium">Drop image or browse</span><span className="block text-xs text-gray-400 mt-1">PNG, JPG, WebP up to 5 MB</span></div>
        <button disabled={!source || busy} onClick={() => void process()} className="w-full rounded-lg border border-cyan-700 text-cyan-800 py-2.5 font-semibold disabled:opacity-50">{busy ? 'Extracting handwriting…' : 'Extract Signature'}</button>
        <label className="block text-xs text-gray-600">Background threshold: {threshold}<input className="w-full" type="range" min="180" max="254" value={threshold} onChange={e => update('threshold', Number(e.target.value))} /></label>
        <label className="block text-xs text-gray-600">Contrast: {contrast.toFixed(1)}<input className="w-full" type="range" min="0.5" max="2" step="0.1" value={contrast} onChange={e => update('contrast', Number(e.target.value))} /></label>
        <label className="block text-xs text-gray-600">Rotation: {rotation}°<input className="w-full" type="range" min="-15" max="15" value={rotation} onChange={e => update('rotation', Number(e.target.value))} /></label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Signature name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <button disabled={busy} onClick={save} className="w-full rounded-lg bg-cyan-700 text-white py-2.5 font-semibold disabled:opacity-50">{busy ? 'Processing…' : 'Save Platform Signature'}</button>
        {message && <p className="text-xs text-cyan-800">{message}</p>}
      </section>
      <section className="grid md:grid-cols-2 gap-4"><Preview title="Before · original" image={source} /><Preview title="After · transparent extracted handwriting" image={result} transparent /></section>
    </div>
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Platform signatures</h2>
        <span className="text-xs text-gray-400">{saved.length} saved</span>
      </div>
      {saved.length === 0 ? (
        <p className="text-sm text-gray-400">No platform signatures yet. Create one above and it will be available to every school.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {saved.map((sig) => (
            <li key={sig.id} className="py-3 flex items-center gap-4">
              <div className="h-10 w-24 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                <img src={sig.transparentImageUrl || sig.processedImageUrl || sig.imageUrl} alt={sig.name} className="max-h-8 max-w-20 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{sig.name}</p>
                <p className="text-xs text-gray-400">Saved {sig.createdAt ? new Date(sig.createdAt).toLocaleDateString() : '-'}{sig.status && sig.status !== 'ACTIVE' ? ` · ${sig.status.toLowerCase()}` : ''}</p>
              </div>
              {sig.status === 'ACTIVE'
                ? <button onClick={() => void revoke(sig.id, sig.name)} className="text-xs text-orange-600 border border-orange-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-orange-50">Revoke</button>
                : <button onClick={() => void restore(sig.id, sig.name)} className="text-xs text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-emerald-50">Restore</button>}
              <button onClick={() => void remove(sig.id, sig.name)} className="text-xs text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-red-50">Delete</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>;
}

interface Signature {
  id: string;
  name: string;
  imageUrl?: string;
  processedImageUrl?: string;
  transparentImageUrl?: string;
  isDefault?: boolean;
  status?: string;
  createdAt?: string;
}

function Preview({ title, image, transparent }: { title: string; image: string; transparent?: boolean }) {
  return <div className={`rounded-xl border border-gray-200 p-3 min-h-[340px] ${transparent ? 'bg-gray-100' : 'bg-white'}`}><h2 className="text-xs text-gray-500 mb-3">{title}</h2>{image ? <img src={image} alt={title} className="w-full h-72 object-contain" /> : <div className="h-72 flex items-center justify-center text-sm text-gray-400">Waiting for image</div>}</div>;
}