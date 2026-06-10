'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradIndigo = 'linear-gradient(135deg, #6366f1, #4f46e5)';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function VerificationDashboardPage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentSignatures, setRecentSignatures] = useState<any[]>([]);
  const [recentBlockchain, setRecentBlockchain] = useState<any[]>([]);
  const [recentApprovals, setRecentApprovals] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVerificationStats();
    }
  }, [isAuthenticated]);

  const loadVerificationStats = async () => {
    try {
      setLoading(true);

      const [signaturesRes, blockchainRes, approvalsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/signing/document/all`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).catch(() => null),
        fetch(`${API_BASE}/api/v1/blockchain/all`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).catch(() => null),
        fetch(`${API_BASE}/api/v1/approval/school/all`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).catch(() => null),
      ]);

      const signatures = signaturesRes?.ok ? await signaturesRes.json() : { signatures: [] };
      const blockchain = blockchainRes?.ok ? await blockchainRes.json() : { certificates: [] };
      const approvals = approvalsRes?.ok ? await approvalsRes.json() : { workflows: [] };

      const sigList = signatures.signatures || [];
      const bcList = blockchain.certificates || [];
      const appList = approvals.workflows || [];

      setStats({
        totalSignatures: sigList.length,
        totalBlockchain: bcList.length,
        totalApprovals: appList.length,
        verifiedDocuments: sigList.filter((s: any) => s.isValid).length,
        blockchainVerified: bcList.length,
        completedApprovals: appList.filter((a: any) => a.status === 'completed').length,
      });

      setRecentSignatures(sigList.slice(0, 5));
      setRecentBlockchain(bcList.slice(0, 5));
      setRecentApprovals(appList.slice(0, 5));
    } catch (error) {
      console.error('Failed to load verification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradIndigo, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-shield-alt"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .stat-card { transition: all 0.3s ease; cursor: pointer; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .table-row { transition: all 0.2s ease; }
        .table-row:hover { background: #f5efe8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ width: '40px', height: '40px', background: gradIndigo, borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-shield-alt" style={{ fontSize: '18px', color: 'white' }}></i>
            </span>
            Document Verification Center
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Manage cryptographic signatures, blockchain certificates, and approval workflows
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/super-admin/verification/signatures" style={{
            padding: '12px 20px', background: gradBlue, color: 'white',
            borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
          }}>
            <i className="fa fa-pen"></i> Signatures
          </Link>
          <Link href="/super-admin/verification/blockchain" style={{
            padding: '12px 20px', background: gradPurple, color: 'white',
            borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(139,92,246,0.3)'
          }}>
            <i className="fa fa-link"></i> Blockchain
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(59,130,246,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: gradBlue, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
              <i className="fa fa-pen-fancy" style={{ fontSize: '24px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '20px' }}>SIGNATURES</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Total Signatures</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalSignatures || 0}</p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>{stats?.verifiedDocuments || 0} valid</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(139,92,246,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: gradPurple, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,92,246,0.3)' }}>
              <i className="fa fa-link" style={{ fontSize: '24px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '4px 10px', borderRadius: '20px' }}>BLOCKCHAIN</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Blockchain Certs</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalBlockchain || 0}</p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: '#8b5cf6', borderRadius: '50%' }}></span>Immutable records</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(16,185,129,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: gradGreen, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              <i className="fa fa-check-double" style={{ fontSize: '24px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '4px 10px', borderRadius: '20px' }}>APPROVALS</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>Approval Workflows</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalApprovals || 0}</p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>{stats?.completedApprovals || 0} completed</span>
          </div>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '96px', height: '96px', background: 'rgba(234,102,69,0.1)', borderBottomLeftRadius: '48px' }}></div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: gradOrange, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(234,102,69,0.3)' }}>
              <i className="fa fa-qrcode" style={{ fontSize: '24px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#ea6645', background: '#fff7ed', padding: '4px 10px', borderRadius: '20px' }}>QR CODES</span>
          </div>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>QR Generated</p>
          <p style={{ fontSize: '36px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{stats?.totalSignatures || 0}</p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <span style={{ fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', background: '#ea6645', borderRadius: '50%' }}></span>Scannable</span>
          </div>
        </div>
      </div>

      {/* Recent Signatures & Blockchain */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        {/* Recent Signatures */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-pen-fancy" style={{ color: '#3b82f6' }}></i> Recent Signatures
            </h2>
            <Link href="/super-admin/verification/signatures" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all <i className="fa fa-arrow-right" style={{ fontSize: '11px' }}></i></Link>
          </div>
          {recentSignatures.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentSignatures.map((sig: any) => (
                <div key={sig.id} className="table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '12px', border: '1px solid #f3f4f6', background: '#fefcf9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: sig.isValid ? '#d1fae5' : '#fef2f2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa ${sig.isValid ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ fontSize: '18px', color: sig.isValid ? '#10b981' : '#ef4444' }}></i>
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{sig.documentType}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontFamily: 'monospace' }}>{sig.verificationToken?.substring(0, 12)}...</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(sig.signedAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No signatures yet</p>
          )}
        </div>

        {/* Recent Blockchain Certs */}
        <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <i className="fa fa-link" style={{ color: '#8b5cf6' }}></i> Recent Blockchain Certs
            </h2>
            <Link href="/super-admin/verification/blockchain" style={{ fontSize: '13px', color: '#8b5cf6', textDecoration: 'none', fontWeight: 500 }}>View all <i className="fa fa-arrow-right" style={{ fontSize: '11px' }}></i></Link>
          </div>
          {recentBlockchain.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentBlockchain.map((bc: any) => (
                <div key={bc.id} className="table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '12px', border: '1px solid #f3f4f6', background: '#fefcf9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', background: '#ede9fe', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa fa-cube" style={{ fontSize: '18px', color: '#8b5cf6' }}></i>
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', margin: 0 }}>{bc.blockchainNetwork}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, fontFamily: 'monospace' }}>{bc.transactionHash?.substring(0, 16)}...</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{new Date(bc.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: '#9ca3af', textAlign: 'center', padding: '32px 0' }}>No blockchain certs yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa fa-bolt" style={{ color: '#f59e0b' }}></i> Verification Quick Actions
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[
            { href: '/super-admin/verification/signatures', icon: 'fa-pen-fancy', label: 'Document Signatures', desc: 'Manage cryptographic signatures', color: '#3b82f6', bg: '#eff6ff' },
            { href: '/super-admin/verification/blockchain', icon: 'fa-link', label: 'Blockchain Certs', desc: 'View blockchain records', color: '#8b5cf6', bg: '#f5f3ff' },
            { href: '/super-admin/verification/ministry', icon: 'fa-building', label: 'Ministry Verifications', desc: 'Track ministry API status', color: '#10b981', bg: '#ecfdf5' },
            { href: '/super-admin/verification/approvals', icon: 'fa-check-double', label: 'Approval Workflows', desc: 'Monitor approval chains', color: '#f59e0b', bg: '#fffbeb' },
            { href: '/super-admin/stamp-verifications', icon: 'fa-stamp', label: 'Stamp Verifications', desc: 'Digital stamp management', color: '#0d9488', bg: '#f0fdfa' },
            { href: '/verify/certificate', icon: 'fa-external-link-alt', label: 'Public Portal', desc: 'Open verification portal', color: '#6366f1', bg: '#eef2ff' },
          ].map(item => (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
              borderRadius: '12px', border: '1px solid #f3f4f6', textDecoration: 'none',
              background: '#fefcf9', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = item.color; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#f3f4f6'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa ${item.icon}`} style={{ fontSize: '18px', color: item.color }}></i>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>{item.desc}</div>
              </div>
              <i className="fa fa-chevron-right" style={{ fontSize: '11px', color: '#d1d5db', marginLeft: 'auto', flexShrink: 0 }}></i>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
