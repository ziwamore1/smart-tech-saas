'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { stampEngineApi, templateBuilderApi } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  templateType?: string;
  status?: string;
}

interface SignatureOption { id: string; name: string; title?: string; scope?: string; status?: string; }
interface SignatoryRow {
  key: string;
  id?: string;
  label: string;
  role: string;
  position: number;
  isRequired: boolean;
  signatureId: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const COMMON_ROLES = ['Class Teacher', 'Head Teacher', 'Deputy Head', 'Director', 'Registrar', 'Principal', 'Examination Officer', 'HOD', 'Secretary'];

export default function TemplateSignatoriesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [rows, setRows] = useState<SignatoryRow[]>([]);
  const [signatures, setSignatures] = useState<SignatureOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const loadSignatures = useCallback(async () => {
    try {
      const response = await templateBuilderApi.getSignatures();
      const data = response.data?.data || response.data || [];
      setSignatures(Array.isArray(data) ? data.filter((s: any) => (s.status || 'ACTIVE') === 'ACTIVE') : []);
    } catch { /* transient */ }
  }, []);

  useEffect(() => { void loadSignatures(); }, [loadSignatures]);

  useEffect(() => {
    stampEngineApi.listTemplates()
      .then(r => {
        const data = r.data?.templates || r.data || [];
        setTemplates(Array.isArray(data) ? data.filter((t: any) => t.id && t.name && (t.status || 'DRAFT') === 'PUBLISHED') : []);
      })
      .catch(() => undefined);
  }, []);

  const selectTemplate = async (id: string) => {
    setSelectedId(id);
    setMessage('');
    if (!id) { setRows([]); return; }
    setBusy(true);
    try {
      const response = await templateBuilderApi.getStampTemplateSignatories(id);
      const data = response.data?.data || response.data || [];
      const list = Array.isArray(data) ? data : [];
      setRows(list.map((s: any, i: number) => ({
        key: uid(), id: s.id, label: s.label || '', role: s.role || '', position: s.position ?? i, isRequired: s.isRequired !== false, signatureId: s.signatureId || '',
      })));
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not load signatories'); }
    finally { setBusy(false); }
  };

  const patch = (key: string, patch: Partial<SignatoryRow>) =>
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    const next = rows.length;
    setRows(prev => [...prev, { key: uid(), label: next === 0 ? 'Primary signatory' : 'Additional signatory', role: COMMON_ROLES[Math.min(next, COMMON_ROLES.length - 1)], position: next, isRequired: true, signatureId: '' }]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const swap = index + dir;
    if (swap < 0 || swap >= rows.length) return;
    setRows(prev => prev.map((r, i) => i === index ? prev[swap] : i === swap ? prev[index] : r).map((r, i) => ({ ...r, position: i })));
  };

  const removeRow = (key: string) => setRows(prev => prev.filter(r => r.key !== key));

  const save = async () => {
    if (!selectedId) return;
    if (rows.length === 0) { setMessage('Add at least one signatory position, then save.'); return; }
    const labelsOk = rows.every(r => r.label.trim());
    if (!labelsOk) { setMessage('Every position needs a label (e.g. "Class Teacher").'); return; }
    setBusy(true);
    try {
      await templateBuilderApi.saveStampTemplateSignatories(selectedId, rows.map((r, i) => ({
        id: r.id, label: r.label.trim(), role: r.role.trim() || null, position: i, isRequired: r.isRequired, signatureId: r.signatureId || null,
      })));
      setMessage('Signatory positions saved for this document type.');
      void selectTemplate(selectedId);
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not save signatories'); }
    finally { setBusy(false); }
  };

  const selectedTemplate = useMemo(() => templates.find(t => t.id === selectedId), [templates, selectedId]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Type Signatories</h1>
        <p className="text-sm text-gray-500 mt-1">Each stamp/document template declares the signature positions it requires. At issuance, every position is bound to a staff member and their saved signature — so a document can need both a Class Teacher and a Head Teacher.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <label className="block text-xs font-medium text-gray-600">Document template
          <select value={selectedId} onChange={e => void selectTemplate(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select a published template…</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>

        {selectedTemplate && (
          <div className="text-xs bg-blue-50 text-blue-900 rounded-lg px-3 py-2">
            <i className="fa fa-file-text-o" style={{ marginRight: '6px' }}></i>
            {selectedTemplate.name}{selectedTemplate.type ? ` · ${String(selectedTemplate.type).replace(/_/g, ' ')}` : ''}
          </div>
        )}

        {selectedId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Signature positions ({rows.length})</span>
              <button type="button" onClick={addRow} className="text-xs text-blue-600 font-semibold border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50">
                <i className="fa fa-plus" style={{ fontSize: '10px' }}></i> Add position
              </button>
            </div>

            {rows.length === 0 && (
              <p className="text-sm text-gray-400">No signatory positions declared yet. Add the first one (e.g. "Class Teacher" then "Head Teacher") and it will be required when this document type is issued.</p>
            )}

            {rows.map((row, index) => (
              <div key={row.key} className={row.isRequired ? 'border border-l-4 border-l-blue-500 border-gray-200 rounded-lg p-3 bg-white space-y-2' : 'border border-gray-200 rounded-lg p-3 bg-white space-y-2 opacity-80'}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold text-gray-400 w-6">{index + 1}.</span>
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-medium text-gray-600">Position label</label>
                    <input value={row.label} onChange={e => patch(row.key, { label: e.target.value })} placeholder="e.g. Class Teacher" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <label className="block text-xs font-medium text-gray-600">Role (optional)</label>
                    <input value={row.role} onChange={e => patch(row.key, { role: e.target.value })} list="common-roles" placeholder="Role or title" className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm" />
                    <datalist id="common-roles">{COMMON_ROLES.map(r => <option key={r} value={r} />)}</datalist>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-xs font-medium text-gray-600">Default bound signature (optional)</label>
                    <select value={row.signatureId} onChange={e => patch(row.key, { signatureId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-1.5 text-sm">
                      <option value="">Choose at issuance</option>
                      {signatures.map(s => <option key={s.id} value={s.id}>{s.name}{s.title ? ` — ${s.title}` : ''}{s.scope === 'PLATFORM' ? ' (platform)' : ''}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between pl-9">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={row.isRequired} onChange={e => patch(row.key, { isRequired: e.target.checked })} />
                    Required — issuance blocks until this position is assigned
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-30"><i className="fa fa-arrow-up" /></button>
                    <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1} className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 disabled:opacity-30"><i className="fa fa-arrow-down" /></button>
                    <button type="button" onClick={() => removeRow(row.key)} className="text-xs text-red-500 border border-red-100 rounded-lg px-2 py-1 hover:bg-red-50"><i className="fa fa-trash" /></button>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-3">
              <button disabled={busy || rows.length === 0} onClick={save} className="rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {busy ? 'Saving…' : 'Save Signatory Positions'}
              </button>
              {message && <span className="text-xs text-gray-600">{message}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}