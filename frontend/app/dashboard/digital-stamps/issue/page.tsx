'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, stampEngineApi } from '@/lib/api';
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

export default function IssueOfficialDocumentPage() {
  const { user } = useAuth() as any;
  const [documentId, setDocumentId] = useState('');
  const [documentType, setDocumentType] = useState('TRANSCRIPT');
  const [title, setTitle] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(true);
  const [signerRole, setSignerRole] = useState('Head Teacher');
  const [signatureId, setSignatureId] = useState('');
  const [signatures, setSignatures] = useState<any[]>([]);
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
    api.get('/template-builder/signatures').then(r => {
      const list = Array.isArray(r.data) ? r.data : (r.data?.signatures || []);
      const active = list.filter((s: any) => s.status !== 'REVOKED');
      setSignatures(active);
      setSignatureId(active.find((s: any) => s.isDefault)?.id || active[0]?.id || '');
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

  const canIssue = useMemo(() => documentId && documentType && (!requiresSignature || signerRole), [documentId, documentType, requiresSignature, signerRole]);

  const setStep = (key: string, state: StepState['state']) =>
    setSteps(prev => prev.map(s => (s.key === key ? { ...s, state } : s)));

  const issue = async () => {
    setError(''); setResult(null); setCopied(false);
    const withSig = requiresSignature;
    setSteps(initialSteps(withSig));
    setStep('stamp', 'running');
    setBusy(true);
    try {
      const res = await stampEngineApi.authentication.issue({
        schoolId: user?.schoolId,
        documentId,
        documentType,
        documentTitle: title || undefined,
        issuedToLabel: issuedTo || undefined,
        stampTemplateId: templateId || undefined,
        requiresSignature: withSig,
        signatureId: signatureId || undefined,
        signers: withSig
          ? [{ signerId: user?.id || 'authorised-signatory', signerName: user?.name, signerRole }]
          : [],
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
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs font-medium text-gray-600">Handwritten signature
                <select value={signatureId} onChange={e => setSignatureId(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">Institution default</option>
                  {signatures.map(s => <option key={s.id} value={s.id}>{s.name}{s.isDefault ? ' (Default)' : ''}</option>)}
                </select>
              </label>
              <label className="block text-xs font-medium text-gray-600">Signing authority role
                <select value={signerRole} onChange={e => setSignerRole(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  {['Head Teacher', 'Director', 'Registrar', 'Principal', 'Examination Officer'].map(r => <option key={r}>{r}</option>)}
                </select>
              </label>
              <div className="text-xs text-gray-400 self-end pb-2">Signed by you as authorised signatory</div>
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
