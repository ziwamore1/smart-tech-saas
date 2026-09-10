'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { superAdminApi, systemCommunicationsApi } from '@/lib/api';
import Link from 'next/link';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING_REVIEW: { bg: '#fef3c7', color: '#d97706', label: 'Pending Review' },
  CONTACTED: { bg: '#dbeafe', color: '#2563eb', label: 'Contacted' },
  APPROVED: { bg: '#d1fae5', color: '#059669', label: 'Approved / Trial Active' },
  REJECTED: { bg: '#fee2e2', color: '#dc2626', label: 'Needs Info' },
};

export default function RegistrationRequestDetailPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [req, setReq] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [subject, setSubject] = useState('Smart Tech school registration follow-up');
  const [reply, setReply] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const loadRequest = async () => {
    try {
      const response = await superAdminApi.getRegistrationRequest(id);
      setReq(response.data);
    } catch (err) {
      console.error('Failed to load registration request:', err);
      setError('Could not load this registration request.');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await systemCommunicationsApi.getTemplates();
      const body = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setTemplates(body.filter((t: any) => t.type === 'EMAIL' && (!t.category || t.category === 'registration')));
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && id) {
      loadRequest();
      loadTemplates();
    }
  }, [isAuthenticated, id]);

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!req) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
        <p>{error || 'Request not found.'}</p>
        <Link href="/super-admin/registrations" style={{ color: '#ea6645', fontWeight: 600 }}>Back to Registration Inbox</Link>
      </div>
    );
  }

  const st = STATUS_STYLES[req.status] || { bg: '#f3f4f6', color: '#6b7280', label: req.status };
  const messages = req.messages || [];

  const applyTemplate = (templateId: string) => {
    const t = templates.find((x: any) => x.id === templateId);
    if (t) {
      setSubject(t.subject || '');
      setReply(t.message.replace(/\{directorFirstName\}/g, req.directorFirstName).replace(/\{schoolName\}/g, req.schoolName).replace(/\{registrationNumber\}/g, req.school?.registrationNumber || ''));
    }
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      await superAdminApi.sendRegistrationMessage(id, { subject, message: reply });
      setReply('');
      setSubject('Smart Tech school registration follow-up');
      await loadRequest();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send message.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('Approve this registration? The school will be activated on a 30-day trial.')) return;
    setBusy(true);
    setError('');
    try {
      await superAdminApi.approveRegistrationRequest(id, notes || undefined);
      await loadRequest();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to approve request.');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      setError('Please add a note explaining what information is needed before rejecting.');
      return;
    }
    if (!window.confirm('Reject this registration and email the applicant for more information?')) return;
    setBusy(true);
    setError('');
    try {
      await superAdminApi.rejectRegistrationRequest(id, notes);
      await loadRequest();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to reject request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/super-admin/registrations" style={{ color: '#9ca3af', fontSize: '20px' }}><i className="fa fa-arrow-left"></i></Link>
        <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa fa-building" style={{ fontSize: '20px', color: 'white' }}></i>
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{req.schoolName}</h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Registration request from {req.directorFirstName} {req.directorLastName}</p>
        </div>
        <span style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '999px', background: st.bg, color: st.color }}>{st.label}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-school" style={{ color: '#ea6645' }}></i> School Details
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            {[
              { label: 'Registration Number', value: req.school?.registrationNumber || '—' },
              { label: 'Institution Type', value: req.institutionType.replace(/_/g, ' ').toLowerCase() },
              { label: 'Applicant', value: `${req.directorFirstName} ${req.directorLastName}` },
              { label: 'Email', value: req.email },
              { label: 'Phone', value: req.phone || '—' },
              { label: 'Address', value: req.address || '—' },
              { label: 'Expected Learners', value: req.expectedLearners ? req.expectedLearners.toLocaleString() : '—' },
              { label: 'Preferred Contact', value: req.contactPreference || '—' },
              { label: 'Requested', value: new Date(req.createdAt).toLocaleString() },
              { label: 'Last Contacted', value: req.lastContactedAt ? new Date(req.lastContactedAt).toLocaleString() : '—' },
              { label: 'Trial Ends', value: req.school?.trialEndsAt ? new Date(req.school.trialEndsAt).toLocaleDateString() : '—' },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid #f3f4f6', paddingBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: '#1f2937', textAlign: 'right' }}>{row.value}</span>
              </div>
            ))}
            {req.registrationPurpose && (
              <div>
                <p style={{ color: '#6b7280', margin: '0 0 4px' }}>Registration Purpose</p>
                <p style={{ margin: 0, color: '#374151', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px' }}>{req.registrationPurpose}</p>
              </div>
            )}
            {req.school && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                {req.school.isActive ? (
                  <span style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '8px', background: '#d1fae5', color: '#059669' }}><i className="fa fa-check-circle"></i> Workspace Active</span>
                ) : (
                  <span style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '8px', background: '#f3f4f6', color: '#6b7280' }}>Workspace Inactive</span>
                )}
                <span style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 600, borderRadius: '8px', background: '#fef3c7', color: '#d97706' }}>{req.school.subscriptionStatus}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa fa-comments" style={{ color: '#3b82f6' }}></i> Conversation
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, maxHeight: '420px', overflow: 'auto' }}>
            {messages.length === 0 && <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No messages yet.</p>}
            {messages.map((m: any) => (
              <div key={m.id} style={{ alignSelf: m.direction === 'OUTBOUND' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '12px 14px', borderRadius: '12px', background: m.direction === 'OUTBOUND' ? 'linear-gradient(135deg, #ea6645, #f59e0b)' : '#f3f4f6', color: m.direction === 'OUTBOUND' ? 'white' : '#1f2937' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>{m.direction === 'OUTBOUND' ? 'Sent by you' : `From applicant${m.senderEmail ? ` (${m.senderEmail})` : ''}`} · {new Date(m.createdAt).toLocaleString()}</p>
                {m.subject && <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700 }}>{m.subject}</p>}
                <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.message}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                onChange={(e) => applyTemplate(e.target.value)}
                defaultValue=""
                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px', background: '#fefcf9' }}
              >
                <option value="">Insert email template…</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px' }}
            />
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a message to the applicant…"
              rows={4}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handleSend}
                disabled={busy || !reply.trim()}
                style={{ padding: '11px 20px', background: 'linear-gradient(135deg, #ea6645, #f59e0b)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', flex: 1 }}
              >
                <i className="fa fa-paper-plane"></i> Send Message
              </button>
              <button
                onClick={handleApprove}
                disabled={busy || req.status === 'APPROVED'}
                style={{ padding: '11px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                <i className="fa fa-check"></i> Approve
              </button>
              <button
                onClick={handleReject}
                disabled={busy || req.status === 'REJECTED'}
                style={{ padding: '11px 20px', background: '#fefcf9', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', color: '#dc2626' }}
              >
                <i className="fa fa-exclamation-circle"></i> Needs Info
              </button>
            </div>
            {req.status !== 'APPROVED' && req.status !== 'REJECTED' && (
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Owner notes (optional for approval, required for Needs Info)"
                style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #e8ddd0', fontSize: '13px' }}
              />
            )}
            {req.ownerNotes && (
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', background: '#f3f4f6', borderRadius: '8px', padding: '10px' }}>
                <strong>Owner notes:</strong> {req.ownerNotes}
              </p>
            )}
            {error && (
              <p style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>{error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}