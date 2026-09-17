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
  scope?: string;
  width?: number;
  height?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface SvgOptions {
  shape: string;
  type: string;
  text: string;
  subtitle?: string;
  width: number;
  height: number;
  ink: string;
  border: string;
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
  MINISTRY: '#1a237e', DEPARTMENT: '#37474f', REGISTRATION_BOARD: '#004d40', CUSTOM: '#333333',
};

const BORDERS: Record<string, string> = {
  APPROVED: '#1b5e20', PAID: '#1b5e20', VERIFIED: '#0d47a1', CONFIDENTIAL: '#b71c1c',
  OFFICIAL_SCHOOL: '#1a365d', PRINCIPAL: '#311b92', EXAMINATION: '#bf360c', REGISTRAR: '#004d40',
  MINISTRY: '#0d1430', DEPARTMENT: '#263238', REGISTRATION_BOARD: '#00251a', CUSTOM: '#555555',
};

function accent(type: string): string {
  return ACCENTS[(type || '').toUpperCase()] || '#333333';
}

function borderColor(type: string): string {
  return BORDERS[(type || '').toUpperCase()] || '#555555';
}

function circularSvg(o: SvgOptions): string {
  const size = o.width;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4, innerR = r - 16;
  const fontSize = Math.max(8, Math.floor(r / 6));
  const innerFontSize = Math.max(10, Math.floor(r / 5));
  const subSize = Math.max(6, fontSize - 4);
  const bottom = o.subtitle?.trim() || formatDate();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><path id="topArc" d="M ${cx - innerR + 4},${cy} A ${innerR - 4},${innerR - 4} 0 0,1 ${cx + innerR - 4},${cy}" fill="none"/><path id="bottomArc" d="M ${cx - innerR + 8},${cy} A ${innerR - 8},${innerR - 8} 0 0,0 ${cx + innerR - 8},${cy}" fill="none"/></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${o.border}" stroke-width="2.5"/><circle cx="${cx}" cy="${cy}" r="${r - 7}" fill="none" stroke="${o.ink}" stroke-width="1" stroke-dasharray="3,3"/><circle cx="${cx}" cy="${cy}" r="${innerR}" fill="none" stroke="${o.border}" stroke-width="1.5"/><text font-size="${fontSize}" font-family="Georgia, 'Times New Roman', serif" fill="${o.border}" font-weight="bold" text-anchor="middle" letter-spacing="2"><textPath href="#topArc" startOffset="50%">${escapeXml(o.text)}</textPath></text><text x="${cx}" y="${cy - 10}" font-size="${innerFontSize}" font-family="Arial, sans-serif" fill="${o.ink}" font-weight="bold" text-anchor="middle">${escapeXml(o.type)}</text><polygon points="${cx - 12},${cy + 4} ${cx},${cy - 8} ${cx + 12},${cy + 4} ${cx},${cy + 16}" fill="${o.ink}" opacity="0.9"/><text x="${cx}" y="${cy + 30}" font-size="${subSize}" font-family="Arial, sans-serif" fill="#666" text-anchor="middle"><textPath href="#bottomArc" startOffset="50%">${escapeXml(bottom)}</textPath></text></svg>`;
}

function boxSvg(o: SvgOptions, shape: string): string {
  const { width, height, ink, border } = o;
  const isOval = shape === 'OVAL';
  const isSquare = shape === 'SQUARE';
  const corner = isSquare ? 4 : 8;
  const rx = width / 2 - 4, ry = height / 2 - 4;
  const typeSize = Math.max(10, Math.floor(height / 5));
  const textSize = Math.max(7, Math.floor(height / 8));
  const subSize = Math.max(6, Math.floor(height / 10));
  const sub = o.subtitle?.trim() || formatDate();
  const outer = isOval
    ? `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx}" ry="${ry}" fill="none" stroke="${border}" stroke-width="2.5"/>`
    : `<rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${corner}" ry="${corner}" fill="none" stroke="${border}" stroke-width="2.5"/>`;
  const inner = isOval
    ? `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${rx - 6}" ry="${ry - 6}" fill="none" stroke="${ink}" stroke-width="0.8" stroke-dasharray="3,3"/>`
    : `<rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="${Math.max(3, corner - 2)}" ry="${Math.max(3, corner - 2)}" fill="none" stroke="${ink}" stroke-width="0.8" stroke-dasharray="3,3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${outer}${inner}<text x="${width / 2}" y="${height / 2 - 14}" font-size="${typeSize}" font-family="Arial, sans-serif" fill="${ink}" font-weight="bold" text-anchor="middle" letter-spacing="2">${escapeXml(o.type)}</text><text x="${width / 2}" y="${height / 2 + 10}" font-size="${textSize}" font-family="Arial, sans-serif" fill="#333" text-anchor="middle">${escapeXml(o.text)}</text><text x="${width / 2}" y="${height / 2 + 28}" font-size="${subSize}" font-family="Arial, sans-serif" fill="#888" text-anchor="middle">${escapeXml(sub)}</text></svg>`;
}

function buildSvg(o: SvgOptions): string {
  if (o.shape === 'CIRCULAR') return circularSvg(o);
  return boxSvg(o, o.shape);
}

const TYPES = ['CUSTOM', 'OFFICIAL_SCHOOL', 'APPROVED', 'VERIFIED', 'PAID', 'CONFIDENTIAL', 'PRINCIPAL', 'EXAMINATION', 'REGISTRAR', 'MINISTRY', 'DEPARTMENT', 'REGISTRATION_BOARD'];
const SHAPES = ['CIRCULAR', 'RECTANGULAR', 'SQUARE', 'OVAL'];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REVOKED: 'bg-red-50 text-red-700 border-red-200',
  SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
  ARCHIVED: 'bg-gray-100 text-gray-600 border-gray-200',
};

function slug(name: string): string {
  return (name || 'stamp').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'stamp';
}

export default function SuperAdminStampDesignerPage() {
  const [name, setName] = useState('Official Platform Stamp');
  const [text, setText] = useState('INSTITUTION NAME');
  const [subtitle, setSubtitle] = useState('');
  const [type, setType] = useState('OFFICIAL_SCHOOL');
  const [shape, setShape] = useState('CIRCULAR');
  const [ink, setInk] = useState(accent('OFFICIAL_SCHOOL'));
  const [border, setBorder] = useState(borderColor('OFFICIAL_SCHOOL'));
  const [width, setWidth] = useState(200);
  const [height, setHeight] = useState(200);
  const [opacity, setOpacity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error'>('success');
  const [list, setList] = useState<PlatformStamp[]>([]);
  const [search, setSearch] = useState('');

  const effectiveHeight = shape === 'CIRCULAR' ? width : height;

  const svgContent = useMemo(
    () => buildSvg({ shape, type, text: text || 'INSTITUTION NAME', subtitle, width, height: effectiveHeight, ink, border }),
    [shape, type, text, subtitle, width, effectiveHeight, ink, border],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await stampApi.getStamps({ scope: 'PLATFORM' });
      const payload = response.data?.stamps ?? response.data?.data ?? response.data;
      setList(Array.isArray(payload) ? payload : []);
    } catch (error: any) {
      setMessageKind('error');
      setMessage(error?.response?.data?.message || 'Could not load platform stamps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const applyType = (next: string) => {
    setType(next);
    setInk(accent(next));
    setBorder(borderColor(next));
  };

  const save = async () => {
    if (!name.trim()) { setMessageKind('error'); setMessage('Give the stamp a name first.'); return; }
    setBusy(true);
    try {
      await stampApi.createStamp({ name: name.trim(), type, shape, svgContent, width, height: effectiveHeight, opacity, scope: 'PLATFORM' });
      setMessageKind('success');
      setMessage('Platform stamp saved. Schools can now add it to their templates.');
      void load();
    } catch (error: any) {
      setMessageKind('error');
      setMessage(error?.response?.data?.message || 'Could not save stamp');
    } finally { setBusy(false); }
  };

  const setStatus = async (id: string, stampName: string, status: string) => {
    if (status === 'ACTIVE') {
      if (!window.confirm(`Restore "${stampName}" to Active?`)) return;
      try {
        await stampApi.setStampStatus(id, status);
        setMessageKind('success'); setMessage(`"${stampName}" restored to Active.`);
        void load();
      } catch (error: any) { setMessageKind('error'); setMessage(error?.response?.data?.message || 'Could not update stamp'); }
      return;
    }
    const raw = window.prompt(`Reason for ${status.toLowerCase()}ing "${stampName}"?`, 'No longer valid');
    if (raw === null) return;
    const reason = raw.trim() || 'Managed by super admin';
    try {
      await stampApi.setStampStatus(id, status, reason);
      setMessageKind('success'); setMessage(`"${stampName}" marked ${status.toLowerCase()}.`);
      void load();
    } catch (error: any) { setMessageKind('error'); setMessage(error?.response?.data?.message || 'Could not update stamp'); }
  };

  const remove = async (id: string, stampName: string) => {
    if (!window.confirm(`Delete platform stamp "${stampName}"? This cannot be undone.`)) return;
    try {
      await stampApi.deleteStamp(id);
      setMessageKind('success'); setMessage(`"${stampName}" deleted.`);
      void load();
    } catch (error: any) { setMessageKind('error'); setMessage(error?.response?.data?.message || 'Could not delete stamp'); }
  };

  const duplicate = async (id: string, stampName: string) => {
    try {
      await stampApi.duplicateStamp(id);
      setMessageKind('success'); setMessage(`"${stampName}" duplicated.`);
      void load();
    } catch (error: any) { setMessageKind('error'); setMessage(error?.response?.data?.message || 'Could not duplicate stamp'); }
  };

  const download = (stamp: PlatformStamp) => {
    const svg = stamp.svgContent || buildSvg({
      shape: stamp.shape, type: stamp.type, text: stamp.name, width: stamp.width || 200, height: stamp.height || 200,
      ink: accent(stamp.type), border: borderColor(stamp.type),
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(stamp.name)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadCurrent = () => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(name)}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(
    () => list.filter(s => !search.trim() || s.name?.toLowerCase().includes(search.trim().toLowerCase())),
    [list, search],
  );
  const activeCount = useMemo(() => list.filter(s => (s.status || 'ACTIVE') === 'ACTIVE').length, [list]);

  return <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Platform Stamp Designer</h1>
      <p className="text-sm text-gray-500 mt-1">Create institution-level digital stamps available to every school. Revoked stamps stop appearing in school templates.</p>
    </div>

    {message && (
      <p className={`text-sm rounded-lg px-4 py-2 ${messageKind === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{message}</p>
    )}

    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="font-semibold">Stamp details</h2>
        <label className="block text-xs text-gray-600">Stamp name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Institution / stamp name" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs text-gray-600">Stamp text (top arc)
          <input value={text} onChange={e => setText(e.target.value)} placeholder="INSTITUTION NAME" maxLength={60} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs text-gray-600">Subtitle / footer <span className="text-gray-400">(optional)</span>
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder={"Defaults to today's date"} maxLength={40} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">Shape
            <select value={shape} onChange={e => setShape(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1">
              {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block text-xs text-gray-600">Type
            <select value={type} onChange={e => applyType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm mt-1">
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">Ink colour
            <input type="color" value={ink} onChange={e => setInk(e.target.value)} className="mt-1 w-full h-9 rounded cursor-pointer" />
          </label>
          <label className="block text-xs text-gray-600">Border colour
            <input type="color" value={border} onChange={e => setBorder(e.target.value)} className="mt-1 w-full h-9 rounded cursor-pointer" />
          </label>
        </div>
        <label className="block text-xs text-gray-600">Width: {width}px<input className="w-full" type="range" min="100" max="400" value={width} onChange={e => setWidth(Number(e.target.value))} /></label>
        {shape === 'CIRCULAR'
          ? <p className="text-xs text-gray-400">Height: {width}px (locks to width for circular stamps)</p>
          : <label className="block text-xs text-gray-600">Height: {height}px<input className="w-full" type="range" min="60" max="260" value={height} onChange={e => setHeight(Number(e.target.value))} /></label>}
        <label className="block text-xs text-gray-600">Opacity: {opacity.toFixed(1)}<input className="w-full" type="range" min="0.2" max="1" step="0.1" value={opacity} onChange={e => setOpacity(Number(e.target.value))} /></label>
        <div className="flex gap-2">
          <button disabled={busy} onClick={save} className="flex-1 rounded-lg bg-cyan-700 text-white py-2.5 font-semibold disabled:opacity-50">{busy ? 'Saving…' : 'Save Platform Stamp'}</button>
          <button onClick={downloadCurrent} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Download SVG</button>
        </div>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center min-h-[300px]">
        <div className="flex items-center justify-center w-full h-full flex-1 bg-[radial-gradient(circle,#e5e7eb_1px,transparent_1px)] bg-[size:16px_16px] rounded-xl p-6" style={{ opacity }}>
          <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ maxWidth: '100%' }} />
        </div>
        <p className="text-[11px] text-gray-400 mt-3">{shape} · {width}×{effectiveHeight}px · {type}</p>
      </section>
    </div>

    <section className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold">Platform stamps</h2>
          <span className="text-xs text-gray-400">{list.length} published · {activeCount} active</span>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stamps…" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56" />
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading platform stamps…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">{list.length === 0 ? 'No platform stamps yet. Design one above and publish it for all schools.' : 'No stamps match your search.'}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {filtered.map((stamp) => {
            const status = stamp.status || 'ACTIVE';
            return (
              <li key={stamp.id} className="py-3 flex items-center gap-4">
                <div className="h-12 w-20 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(stamp.svgContent || buildSvg({ shape: stamp.shape, type: stamp.type, text: stamp.name, width: stamp.width || 200, height: stamp.height || 200, ink: accent(stamp.type), border: borderColor(stamp.type) }))}`}
                    alt={stamp.name}
                    className="max-h-10 max-w-16 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{stamp.name}</p>
                  <p className="text-xs text-gray-400 truncate">{stamp.type} · {stamp.shape} · {stamp.width || '—'}×{stamp.height || '—'}px</p>
                </div>
                <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-1 ${STATUS_STYLE[status] || STATUS_STYLE.ARCHIVED}`}>{status}</span>
                <button onClick={() => download(stamp)} className="text-xs text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-gray-50">SVG</button>
                <button onClick={() => void duplicate(stamp.id, stamp.name)} className="text-xs text-violet-700 border border-violet-200 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-violet-50">Duplicate</button>
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
