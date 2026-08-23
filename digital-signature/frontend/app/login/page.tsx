'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const res = await api<{ accessToken: string }>('/auth/' + mode, {
        method: 'POST',
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password }),
      });
      setToken(res.accessToken);
      router.push('/sign');
    } catch (err: any) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  return (
    <main className="card" style={{ maxWidth: 420 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Digital Signature Service</h1>
      <p className="muted">Organisation access</p>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <label>Organisation name
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>Password (min 8 characters)
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
        </label>
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create organisation'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register instead' : 'Have an account?'}
          </button>
        </div>
        {error && <div className="alert alert-err">{error}</div>}
      </form>
    </main>
  );
}
