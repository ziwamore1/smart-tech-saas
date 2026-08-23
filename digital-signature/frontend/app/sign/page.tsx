'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, clearToken, getToken } from '../../lib/api';

export default function SignPage() {
  const router = useRouter();
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [signedBy, setSignedBy] = useState('');
  const [contentText, setContentText] = useState('{\n  "title": "Certificate of Completion",\n  "recipient": "Jane Doe"\n}');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signOut = () => { clearToken(); router.push('/login'); };

  const sign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setResult(null); setBusy(true);
    try {
      let content: object;
      try { content = JSON.parse(contentText); }
      catch { throw new Error('Document content must be valid JSON'); }
      const res = await api('/signatures', {
        method: 'POST',
        body: JSON.stringify({ documentName, documentType: documentType || undefined, signedBy, content }),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.status === 401 ? 'Session expired — please sign in again.' : err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20 }}>Sign a document</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn btn-ghost" href="/verify">Verify</Link>
          <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <form onSubmit={sign}>
        <label>Document name
          <input value={documentName} onChange={e => setDocumentName(e.target.value)} required />
        </label>
        <label>Document type (optional)
          <input value={documentType} onChange={e => setDocumentType(e.target.value)} placeholder="certificate / transcript / contract" />
        </label>
        <label>Signed by
          <input value={signedBy} onChange={e => setSignedBy(e.target.value)} required placeholder="Authorised signatory name" />
        </label>
        <label>Document content (JSON — hashed canonically before signing)
          <textarea rows={8} value={contentText} onChange={e => setContentText(e.target.value)} className="mono" />
        </label>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-primary" disabled={busy || !getToken()}>Sign with organisation key</button>
        </div>
      </form>

      {error && <div className="alert alert-err">{error}</div>}
      {result && (
        <div className="alert alert-ok">
          <strong>Signed.</strong> Share this verification ID:
          <div className="mono" style={{ marginTop: 6 }}>{result.id}</div>
          <div className="mono" style={{ marginTop: 6, color: '#065f46' }}>SHA-256: {result.canonicalHash}</div>
          <div className="mono" style={{ marginTop: 6 }}>Signature: {result.signature.slice(0, 64)}…</div>
        </div>
      )}
    </main>
  );
}
