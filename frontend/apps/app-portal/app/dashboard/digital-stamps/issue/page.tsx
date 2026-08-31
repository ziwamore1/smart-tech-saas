'use client';

import { useEffect, useMemo, useState } from 'react';
import { stampEngineApi, templateBuilderApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Issue Official Document — one professional flow. Internally:
 * generate → institutional stamp → Ed25519 signature (Signature Service) →
 * verification QR → registration. The user just sees: issue → done.
 */

interface StepState { key: string; label: string; state: 'pending' | 'running' | 'done' | 'failed' | 'skipped'; }

const initialSteps = (withSig: boolean): StepState[] => [
  { key: 'generate', label: 'Document generated', state: 'done' },
  { key: 'stamp', label: 'Institutional stamp applied', state: 'pending' },
  { key: 'sign', label: withSig ? 'Digital signature applied' : 'Digital signature skipped (stamp-only)', state: 'pending' },
  { key: 'qr', label: 'Verification QR generated', state: 'pending' },
  { key: 'register', label: 'Document registered', state: 'pending' },
];

const DOC_TYPES = ['TRANSCRIPT', 'REPORT_CARD', 'CERTIFICATE', 'LEAVING_CERTIFICATE', 'REFERENCE_LETTER'];

interface SignatorySlot { id: string; label: string; role: string; signatureId: string; }

const ROLES = ['Head Teacher', 'Director', 'Registrar', 'Principal', 'Examination Officer', 'Deputy Head', 'Teacher'];

function boundSignaturesHint(slots: SignatorySlot[]): string {
  const n = slots.filter(s => s.signatureId).length;
  if (n === 0) return ' with no bound signature asset';
  if (n === 1) return ' with 1 bound signature asset';
  return ` with ${n} bound signature assets`;
}

export default function IssueOfficialDocumentPage() {
  const { user } = useAuth() as any;
  const [documentId, setDocumentId] = useState('');
  const [documentType, setDocumentType] = useState('TRANSCRIPT');
  const [title, setTitle] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [slots, setSlots] = useState<SignatorySlot[]>([{ id: 's1', label: 'Primary signatory', role: 'Head Teacher', signatureId: '' }]);
  const [signatureOptions, setSignatureOptions] = useState<{ id: string; name: string; title?: string; scope?: string }[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<StepState[]>(initialSteps(true));
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDocumentId(`DOC-${Date.now().toString(36).toUpperCase()}`);
    stampEngineApi.listTemplates().then(r => {
      const list = (r.data.templates || []).filter((t: any) => t.status === 'PUBLISHED');
      setTemplates(list);
      const requestedId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('templateId') : null;
      const selected = list.find((t: any) => t.id === requestedId) || list.find((t: any) => t.isDefault);
      if (selected) setTemplateId(selected.id);
    }).catch(() => undefined);
    templateBuilderApi.getSignatures().then(r => {
      const data = r.data?.data || r.data || [];
      setSignatureOptions(Array.isArray(data) ? data.filter((s: any) => (s.status || 'ACTIVE') === 'ACTIVE') : []);
    }).catch(() => undefined);
  }, []);

  // Marketplace-driven capability detection — teachers never configure manually.
  useEffect(() => {
    if (!templateId) { setCapabilities(null); return; }
    stampEngineApi.authentication.capabilities(templateId)
      .then(r => {
        setCapabilities(r.data?.capabilities || null);
        if (r.data?.capabilities) setRequiresSignature(Boolean(r.data.capabilities.signature));
      })
      .catch(() => undefined);
  }, [templateId]);

  const canIssue = useMemo(() => documentId && documentType && (!requiresSignature || slots.length > 0), [documentId, documentType, requiresSignature, slots.length]);

  const setStep = (key: string, state: StepState['state']) =>
    setSteps(prev => prev.map(s => (s.key === key ? { ...s, state } : s)));

  const patchSlot = (id: string, patch: Partial<SignatorySlot>) =>
    setSlots(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));

  const addSlot = () =>
    setSlots(prev => [...prev, { id: `s${Date.now().toString(36)}`, label: `Additional signatory ${prev.length + 1}`, role: ROLES[Math.min(prev.length, ROLES.length - 1)], signatureId: '' }]);

  const removeSlot = (id: string) =>
    setSlots(prev => prev.filter(s => s.id !== id));

  // Load the stamp template's declared signatory positions (e.g. Class Teacher +
  // Head Teacher) so issuance knows exactly which positions are required. Only
  // seeds our editable slots; the user still binds each to a saved signature asset.
  useEffect(() => {
    if (!templateId) return;
    templateBuilderApi.getStampTemplateSignatories(templateId)
      .then(r => {
        const data = r.data?.data || r.data || [];
        const list = Array.isArray(data) ? data : [];
        if (!list.length) return;
        setSlots(list.map((s: any, i: number) => ({
          id: `sig${i}-${Date.now().toString(36)}`,
          label: s.label || `Signatory ${i + 1}`,
          role: s.role || ROLES[Math.min(i, ROLES.length - 1)],
          signatureId: s.signatureId || '',
        })));
      })
      .catch(() => undefined);
  }, [templateId]);

  const issue = async () => {
    setError(''); setResult(null); setCopied(false);
    const withSig = requiresSignature;
    setSteps(initialSteps(withSig));
    setStep('stamp', 'running');
    setBusy(true);
    try {
      const boundSlots = withSig ? slots.filter(s => s.signatureId) : [];
      const res = await stampEngineApi.authentication.issue({
        schoolId: user?.schoolId,
        documentId,
        documentType,
        documentTitle: title || undefined,
        issuedToLabel: issuedTo || undefined,
        stampTemplateId: templateId || undefined,
        requiresSignature: withSig,
        signers: withSig
          ? slots.map(s => ({ signerId: s.signatureId || user?.id || 'authorised-signatory', signerName: user?.name, signerRole: s.role || 'Head Teacher' }))
          : [],
        ...(boundSlots.length
          ? { signatories: boundSlots.map(s => ({ label: s.label, role: s.role, userId: user?.id, signatureId: s.signatureId })) }
          : {}),
      });
      const d = res.data;
      setStep('stamp', 'done');
      setStep('sign', d.signatures?.length ? 'done' : 'skipped');
      setStep('qr', d.qrCodeDataUrl ? 'done' : 'skipped');
      setStep('register', 'done');
      setResult(d);
    } catch (e: any) {
      const runningKey = steps.find(s => s.state === 'running')?.key;
      if (runningKey) setStep(runningKey, 'failed');
      else setStep('stamp', 'failed');
      setError(e?.response?.data?.message || e?.message || 'Issuance failed');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (result?.verificationUrl) {
      await navigator.clipboard.writeText(result.verificationUrl).catch(() => undefined);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stepIcon = (s: StepState) =>
    s.state === 'done' ? '✓' : s.state === 'running' ? '…' : s.state === 'failed' ? '✕' : s.state === 'skipped' ? '–' : '○';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Issue Official Document</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        One workflow: institutional stamp, cryptographic signature and public verification — applied automatically.
      </p>

      {!result && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-xs font-medium text-gray-600">Document type
              <select value={documentType} onChange={e => setDocumentType(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">Stamp template
              <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Institution default</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">Title (optional)
              <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium text-gray-600">Issued to (public label)
              <input value={issuedTo} onChange={e => setIssuedTo(e.target.value)} placeholder="Shown on public verification only" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
            </label>
          </div>

          {capabilities && (
            <div className="text-xs bg-blue-50 text-blue-900 rounded-lg px-3 py-2">
              Selected template requires:{' '}
              {[
                capabilities.stamp && 'Institutional stamp',
                capabilities.signature && 'Cryptographic signature',
                capabilities.verification && 'Public verification QR',
              ].filter(Boolean).join(' · ') || 'no authentication features'}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={requiresSignature} onChange={e => setRequiresSignature(e.target.checked)} />
            Apply cryptographic digital signature ({process.env.NEXT_PUBLIC_SIGNATURE_LABEL || 'Ed25519 via Signature Service'})
          </label>

          {requiresSignature && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Signature positions</span>
                <button type="button" onClick={addSlot} className="text-xs text-blue-600 font-semibold border border-blue-200 rounded-lg px-2.5 py-1.5 hover:bg-blue-50">
                  <i className="fa fa-plus" style={{ fontSize: '10px' }}></i> Add position
                </button>
              </div>
              <p className="text-xs text-gray-400">Bind each position to a saved signature from the designer (e.g. Director + Head Teacher). Multi-signature documents are cryptographically bound to every bound asset.</p>
              {slots.map((slot, index) => (
                <div key={slot.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                  <label className="block text-xs font-medium text-gray-600">Position label
                    <input value={slot.label} onChange={e => patchSlot(slot.id, { label: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
                  </label>
                  <label className="block text-xs font-medium text-gray-600">Authority role
                    <select value={slot.role} onChange={e => patchSlot(slot.id, { role: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-gray-600">Saved signature to bind
                    <select value={slot.signatureId} onChange={e => patchSlot(slot.id, { signatureId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="">None (role-only signature)</option>
                      {signatureOptions.map(s => (
                        <option key={s.id} value={s.id}>{s.name}{s.title ? ` — ${s.title}` : ''}{s.scope === 'PLATFORM' ? ' (platform)' : ''}</option>
                      ))}
                    </select>
                  </label>
                  {slots.length > 1 && (
                    <button type="button" onClick={() => removeSlot(slot.id)} className="text-xs text-red-500 border border-red-100 rounded-lg px-2.5 py-2 hover:bg-red-50" title="Remove this position">
                      <i className="fa fa-times" style={{ fontSize: '11px' }}></i>
                    </button>
                  )}
                </div>
              ))}
              <div className="text-xs text-gray-400">Signed by you as the authorised signatory{boundSignaturesHint(slots)}.</div>
            </div>
          )}

          {error && <div className="alert-fail text-sm bg-red-50 text-red-800 rounded-lg px-4 py-3">{error}</div>}

          <button disabled={!canIssue || busy} onClick={issue}
            className="w-full py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Authenticating document…' : 'Generate Official Document'}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border p-5 space-y-2">
            {steps.map(s => (
              <div key={s.key} className={`flex items-center gap-3 text-sm ${s.state === 'failed' ? 'text-red-700' : s.state === 'skipped' ? 'text-gray-400' : s.state === 'done' ? 'text-green-800' : 'text-gray-500'}`}>
                <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs ${s.state === 'done' ? 'bg-green-100' : s.state === 'failed' ? 'bg-red-100' : 'bg-gray-100'}`}>{stepIcon(s)}</span>
                {s.label}
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-400 text-xs block">Serial number</span><span className="font-mono">{result.serialNumber}</span></div>
              <div><span className="text-gray-400 text-xs block">Verification code</span><span className="font-mono">{result.verificationCode}</span></div>
              <div><span className="text-gray-400 text-xs block">Signed at (server)</span>{result.stampDate} {result.stampTime}</div>
              <div><span className="text-gray-400 text-xs block">Signatures</span>{result.signatures?.length || 0} × Ed25519</div>
              <div className="col-span-2"><span className="text-gray-400 text-xs block">Canonical hash (SHA-256)</span><span className="font-mono text-[11px] break-all">{result.finalHash}</span></div>
            </div>
            {result.stampSvg && (
              <div className="mt-4 flex justify-center p-3 border rounded-lg"
                dangerouslySetInnerHTML={{ __html: result.stampSvg.replace(/width="[^"]*"/, 'width="220"').replace(/height="[^"]*"/, 'height="220"') }} />
            )}
          </div>

          <div className="flex gap-3">
            <a href={`/v/${result.verificationCode}`} target="_blank" rel="noreferrer"
              className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-medium text-center hover:bg-blue-700">View Verification</a>
            <button onClick={copyLink} className="flex-1 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-50">
              {copied ? 'Link copied ✓' : 'Copy Verification Link'}
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">Integrity reference: {result.finalHash.slice(0, 24)}… kept in the authentication record.</p>
        </div>
      )}
    </div>
  );
}
