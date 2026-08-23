'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

export default function VerifyPage() {
  const [idOrHash, setIdOrHash] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setResult(null); setBusy(true);
    try {
      const res = await api(`/public/verify/${encodeURIComponent(idOrHash.trim())}`);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20 }}>Verify a signature</h1>
        <Link className="btn btn-ghost" href="/sign">Sign</Link>
      </div>
      <p className="muted" style={{ marginTop: 6 }}>
        Public endpoint — no account needed. Enter the signature ID or canonical hash.
      </p>
      <form onSubmit={verify}>
        <label>Signature ID or hash
          <input value={idOrHash} onChange={e => setIdOrHash(e.target.value)} required className="mono" />
        </label>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn-primary" disabled={busy}>Verify</button>
        </div>
      </form>

      {error && <div className="alert alert-err">{error}</div>}
      {result && (
        <div className={`alert ${result.valid ? 'alert-ok' : 'alert-err'}`}>
          <strong>{result.valid ? 'VALID — signature verified.' : `INVALID — ${result.status || result.reason || 'verification failed'}`}</strong>
          {result.signature && (
            <>
              <p style={{ marginTop: 8 }}>Document: <em>{result.signature.documentName}</em> ({result.signature.documentType || 'untyped'})</p>
              <p>Signed by {result.signature.signedBy} on {new Date(result.signature.signedAt).toLocaleString()}</p>
              <p className="mono" style={{ marginTop: 6 }}>SHA-256: {result.signature.canonicalHash}</p>
            </>
          )}
        </div>
      )}
    </main>
  );
}
