'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { stampApi } from '@/lib/api';

interface PlatformStamp {
  id: string;
  name: string;
  type: string;
  shape: string;
  svgContent?: string;
  status?: string;
  createdAt?: string;
}

function escapeXml(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function formatDate(): string {
  const d = new Date();
  const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const ACCENTS: Record<string, string> = {
  APPROVED: '#2e7d32', PAID: '#2e7d32', VERIFIED: '#1565c0', CONFIDENTIAL: '#d32f2f',
  OFFICIAL_SCHOOL: '#c0a030', PRINCIPAL: '#4a148c', EXAMINATION: '#e65100', REGISTRAR: '#00695c',
  MINISTRY: '#1a237e', DEPARTMENT: '#37474f', REGISTRATION_BOARD: '#004d40',
};

function accent(type: string): string {
  return ACCENTS[(type || '').toUpperCase()] || '#333333';
}

function circularSvg(type: string, text: string, size: number): string {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4, innerR = r - 16;
  const fontSize = Math.max(8, Math.floor(r / 6));
  const innerFontSize = Math.max(10, Math.floor(r / 5));
  const ac = accent(type);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><path id="topArc" d="M ${cx - innerR + 4},${cy} A ${innerR - 4},${innerR - 4} 0 0,1 ${cx + innerR - 4},${cy}" fill="none"/><path id="bottomArc" d="M ${cx - innerR + 8},${cy} A ${innerR - 8},${innerR - 8} 0 0,0 ${cx + innerR - 8},${cy}" fill="none"/></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1a365d" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r - 7}" fill="none" stroke="${ac}" stroke-width="1" stroke-dasharray="3,3"/><circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="#1a365d" stroke-width="1.5"/><text font-size="${fontSize}" font-family="Arial, sans-serif" fill="#1a365d" font-weight="bold" text-anchor="middle" letter-spacing="2"><textPath href="#topArc" startOffset="50%">${escapeXml(text)}</textPath></text><text x="${cx}" y="${cy - 10}" font-size="${innerFontSize}" font-family="Arial, sans-serif" fill="${ac}" font-weight="bold" text-anchor="middle">${escapeXml(type)}</text><polygon points="${cx - 12},${cy + 4} ${cx},${cy - 8} ${cx + 12},${cy + 4} ${cx},${cy + 16}" fill="${ac}" opacity="0.9"/><text x="${cx}" y="${cy + 30}" font-size="${Math.max(6, fontSize - 4)}" font-family="Arial, sans-serif" fill="#666" text-anchor="middle"><textPath href="#bottomArc" startOffset="50%">${formatDate()}</textPath></text></svg>`;
}

function boxSvg(shape: string, type: string, text: string, width: number, height: number): string {
  const ac = accent(type);
  const rx = width / 2 - 4, ry = height / 2 - 4;
  if (shape === 'OVAL') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx}" ry="${ry}" fill="none" stroke="#1a365d" stroke-width="2.5"/><ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx - 6}" ry="${ry - 6}" fill="none" stroke="${ac}" stroke-width="0.8" stroke-dasharray="3,3"/><text x="${width / 2}" y="${height / 2 - 14}" font-size="${Math.max(10, Math.floor(height / 5))}" font-family="Arial, sans-serif" fill="${ac}" font-weight="bold" text-anchor="middle" letter-spacing="2">${escapeXml(type)}</text><text x="${width / 2}" y="${height / 2 + 10}" font-size="${Math.max(7, Math.floor(height / 8))}" font-family="Arial, sans-serif" fill="#333" text-anchor="middle">${escapeXml(text)}</text><text x="${width / 2}" y="${height / 2 + 28}" font-size="${Math.max(6, Math.floor(height / 10))}" font-family="Arial, sans-serif" fill="#888" text-anchor="middle">${formatDate()}</text></svg>`;
  }
  const radius = shape === 'SQUARE' ? 4 : 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${radius}" ry="${radius}" fill="none" stroke="#1a365d" stroke-width="2.5"/><rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="${Math.max(3, radius - 2)}" ry="${Math.max(3, radius - 2)}" fill="none" stroke="${ac}" stroke-width="0.8" stroke-dasharray="3,3"/><text x="${width / 2}" y="${height / 2 - 14}" font-size="${Math.max(10, Math.floor(height / 5))}" font-family="Arial, sans-serif" fill="${ac}" font-weight="bold" text-anchor="middle" letter-spacing="2">${escapeXml(type)}</text><text x="${width / 2}" y="${height / 2 + 10}" font-size="${Math.max(7, Math.floor(height / 8))}" font-family="Arial, sans-serif" fill="#333" text-anchor="middle">${escapeXml(text)}</text><text x="${width / 2}" y="${height / 2 + 28}" font-size="${Math.max(6, Math.floor(height / 10))}" font-family="Arial, sans-serif" fill="#888" text-anchor="middle">${formatDate()}</text></svg>`;
}

function buildSvg(shape: string, type: string, text: string, width: number, height: number): string {
  if (shape === 'CIRCULAR') return circularSvg(type, text, width);
  return boxSvg(shape, type, text, width, height);
}

const TYPES = ['CUSTOM', 'OFFICIAL_SCHOOL', 'APPROVED', 'VERIFIED', 'PAID', 'CONFIDENTIAL', 'PRINCIPAL', 'EXAMINATION', 'REGISTRAR', 'MINISTRY', 'DEPARTMENT', 'REGISTRATION_BOARD'];
const SHAPES = ['CIRCULAR', 'RECTANGULAR', 'SQUARE', 'OVAL'];

export default function SuperAdminStampDesignerPage() {
  const [name, setName] = useState('Official Platform Stamp');
  const [type, setType] = useState('OFFICIAL_SCHOOL');
  const [shape, setShape] = useState('CIRCULAR');
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [opacity, setOpacity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [list, setList] = useState<PlatformStamp[]>([]);

  const svgContent = useMemo(
    () => buildSvg(shape, type, name || 'INSTITUTION NAME', width, height),
    [shape, type, name, width, height],
  );

  const load = useCallback(async () => {
    try {
      const response = await stampApi.getStamps({ scope: 'PLATFORM' });
      const data = response.data?.data || response.data || [];
      setList(Array.isArray(data) ? data : []);
    } catch { /* transient */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!name.trim()) { setMessage('Give the stamp a name first.'); return; }
    setBusy(true);
    try {
      await stampApi.createStamp({ name: name.trim(), type, shape, svgContent, width, height, opacity, scope: 'PLATFORM' });
      setMessage('Platform stamp saved. Schools can now add it to their templates.');
      void load();
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not save stamp'); }
    finally { setBusy(false); }
  };

  const setStatus = async (id: string, stampName: string, status: string) => {
    const reason = status === 'ACTIVE' ? undefined : (window.prompt(`Reason for ${status.toLowerCase()}ing "${stampName}"?`) || 'Managed by super admin');
    if (status !== 'ACTIVE' && reason === null) return;
    if (status === 'ACTIVE' && !window.confirm(`Restore "${stampName}"?`)) return;
    try { await stampApi.setStampStatus(id, status, reason); void load(); }
    catch (error: any) { setMessage(error?.response?.data?.message || 'Could not update stamp'); }
  };

  const remove = async (id: string, stampName: string) => {
    if (!window.confirm(`Delete platform stamp "${stampName}"?`)) return;
    try { await stampApi.deleteStamp(id); void load(); }
    catch (error: any) { setMessage(error?.response?.data?.message || 'Could not delete stamp'); }
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Platform Stamp Designer</h1>
      <p className="text-sm text-gray-500 mt-1">Create institution-level digital stamps available to every school. Revoked stamps stop appearing in school templates.</p>
    </div>
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold">Stamp details</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Institution / stamp text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">Shape
            <select value={shape} onChange={e => setShape(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1">
              {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-xs text-gray-600">Type
            <select value={type} onChange={e => setType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1">
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-xs text-gray-600">Width: {width}px<input className="w-full" type="range" min="100" max="400" value={width} onChange={e => setWidth(Number(e.target.value))} /></label>
        <label className="block text-xs text-gray-600">Height: {height}px<input className="w-full" type="range" min="60" max="260" value={height} onChange={e => setHeight(Number(e.target.value))} /></label>
        <label className="block text-xs text-gray-600">Opacity: {opacity.toFixed(1)}<input className="w-full" type="range" min="0.2" max="1" step="0.1" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
        <button disabled={busy} onClick={save} className="w-full rounded-lg bg-cyan-700 text-white py-2.5 font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Platform Stamp'}</button>
        {message && <p className="text-xs text-cyan-800">{message}</p>}
      </section>
      <section className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center justify-center w-full h-full bg-[radial-gradient(circle,#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] rounded-xl" style={{ opacity }}>
          <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ maxWidth: '100%' }} />
        </div>
      </section>
    </div>
    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Platform stamps</h2>
        <span className="text-xs text-gray-400">{list.length} published</span>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-gray-400">No platform stamps yet. Design one above and publish it for all schools.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((stamp) => {
            const status = stamp.status || 'ACTIVE';
            return (
              <li key={stamp.id} className="py-3 flex items-center gap-4">
                <div className="h-12 w-20 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden">
                  <img src={`data:image/svg+xml;utf8,${encodeURIComponent(stamp.svgContent || '')}`} alt={stamp.name} className="max-h-10 max-w-16 object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{stamp.name}</p>
                  <p className="text-xs text-gray-400">{stamp.type} · {stamp.shape}{status !== 'ACTIVE' ? ` · ${status.toLowerCase()}` : ''}</p>
                </div>
                {status === 'ACTIVE'
                  ? <button onClick={() => void setStatus(stamp.id, stamp.name, 'REVOKED')} className="text-xs text-orange-600 border border-orange-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-orange-50">Revoke</button>
                  : <button onClick={() => void setStatus(stamp.id, stamp.name, 'ACTIVE')} className="text-xs text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-emerald-50">Restore</button>}
                <button onClick={() => void remove(stamp.id, stamp.name)} className="text-xs text-red-600 border border-red-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-red-50">Delete</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  </div>;
}