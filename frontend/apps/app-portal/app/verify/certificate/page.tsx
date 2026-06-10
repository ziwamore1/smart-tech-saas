'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function EnhancedVerifyPage() {
  const [verificationToken, setVerificationToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'signature' | 'blockchain' | 'ministry' | 'approvals'>('overview');

  const handleVerify = async () => {
    if (!verificationToken.trim()) {
      setError('Please enter a verification token.');
      return;
    }

    try {
      setVerifying(true);
      setError('');
      setResult(null);

      const response = await fetch(`${API_BASE_URL}/certificate-validation/verify/${verificationToken.trim()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.verification);
      } else {
        setError(data.message || 'Verification failed. Certificate not found.');
      }
    } catch (err: any) {
      setError('Verification failed. Please check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return { bg: '#f0fdf4', text: '#065f46', border: '#10b981', icon: 'fa-check-circle' };
      case 'PARTIALLY_VERIFIED':
        return { bg: '#fffbeb', text: '#92400e', border: '#f59e0b', icon: 'fa-exclamation-circle' };
      case 'INVALID':
        return { bg: '#fef2f2', text: '#991b1b', border: '#ef4444', icon: 'fa-times-circle' };
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#6b7280', icon: 'fa-question-circle' };
    }
  };

  const statusColors = result ? getStatusColor(result.overallStatus) : null;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
      `}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: '40px', paddingTop: '40px' }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            background: '#fefcf9',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }}>
            <i className="fa fa-shield-alt" style={{ fontSize: '36px', color: '#667eea' }}></i>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'white', margin: '0 0 8px', textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
            Certificate Verification Portal
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            SmartTech Educational Intelligence Platform
          </p>
        </motion.div>

        {/* Input Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: '#fefcf9',
            borderRadius: '20px',
            padding: '32px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            marginBottom: '24px',
          }}
        >
          <label style={{ fontSize: '14px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '12px' }}>
            Verification Token / QR Code
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="Enter verification token or scan QR code..."
              style={{
                flex: 1,
                padding: '14px 18px',
                borderRadius: '12px',
                border: '2px solid #e8ddd0',
                fontSize: '15px',
                fontFamily: 'monospace',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e8ddd0'}
            />
            <button
              onClick={handleVerify}
              disabled={verifying}
              style={{
                padding: '14px 32px',
                borderRadius: '12px',
                border: 'none',
                background: verifying ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontSize: '15px',
                fontWeight: 700,
                cursor: verifying ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => !verifying && (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {verifying ? 'Verifying...' : 'Verify Certificate'}
            </button>
          </div>

          {verifying && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '12px' }}>Verifying certificate authenticity...</p>
            </div>
          )}
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                background: '#fef2f2',
                borderRadius: '16px',
                padding: '20px',
                border: '2px solid #fecaca',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <i className="fa fa-exclamation-circle" style={{ fontSize: '24px', color: '#ef4444', flexShrink: 0 }}></i>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b', margin: '0 0 4px' }}>Verification Failed</p>
                <p style={{ fontSize: '14px', color: '#dc2626', margin: 0 }}>{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {result && statusColors && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                background: '#fefcf9',
                borderRadius: '20px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                overflow: 'hidden',
              }}
            >
              {/* Status Header */}
              <div style={{
                padding: '28px',
                background: statusColors.bg,
                borderBottom: `2px solid ${statusColors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: statusColors.border,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <i className={`fa ${statusColors.icon}`} style={{ fontSize: '28px', color: 'white' }}></i>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1f2937' }}>Verification Result</div>
                  <div style={{ fontSize: '15px', color: statusColors.text, fontWeight: 700, marginTop: '4px' }}>
                    {result.overallStatus === 'VERIFIED' ? '✓ FULLY VERIFIED' :
                     result.overallStatus === 'PARTIALLY_VERIFIED' ? '⚠ PARTIALLY VERIFIED' :
                     result.overallStatus === 'INVALID' ? '✗ INVALID' : '? UNVERIFIED'}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e8ddd0', overflowX: 'auto' }}>
                {(['overview', 'signature', 'blockchain', 'ministry', 'approvals'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: '14px 16px',
                      border: 'none',
                      background: activeTab === tab ? '#667eea' : 'white',
                      color: activeTab === tab ? 'white' : '#6b7280',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ padding: '28px' }}>
                {activeTab === 'overview' && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <InfoField label="Document ID" value={result.documentId} />
                    <InfoField label="Document Type" value={result.documentType} />
                    <InfoField label="Institution" value={result.schoolName} />
                    <VerificationBadge label="Cryptographic Signature" valid={result.signatureValid} />
                    <VerificationBadge label="Blockchain Verification" valid={result.blockchainVerified} />
                    <VerificationBadge label="Ministry Verification" valid={result.ministryVerified} />
                    <VerificationBadge label="Approval Chain" valid={result.approvalChainComplete} />
                  </div>
                )}

                {activeTab === 'signature' && result.verificationDetails?.signature && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <InfoField label="Signer ID" value={result.verificationDetails.signature.signerId} />
                    <InfoField label="Signer Role" value={result.verificationDetails.signature.signerRole} />
                    <InfoField label="Signed At" value={new Date(result.verificationDetails.signature.signedAt).toLocaleString()} />
                    <InfoField label="Document Hash" value={result.verificationDetails.signature.documentHash} mono />
                    <VerificationBadge label="Signature Valid" valid={result.verificationDetails.signature.isValid} />
                  </div>
                )}

                {activeTab === 'blockchain' && result.verificationDetails?.blockchain && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <InfoField label="Network" value={result.verificationDetails.blockchain.network} />
                    <InfoField label="Transaction Hash" value={result.verificationDetails.blockchain.transactionHash} mono />
                    <InfoField label="Verification URL" value={result.verificationDetails.blockchain.verificationUrl} mono />
                  </div>
                )}

                {activeTab === 'ministry' && result.verificationDetails?.ministry && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <InfoField label="Status" value={result.verificationDetails.ministry.status} />
                    <InfoField label="Reference" value={result.verificationDetails.ministry.reference} mono />
                    <InfoField label="Verified At" value={result.verificationDetails.ministry.verifiedAt ? new Date(result.verificationDetails.ministry.verifiedAt).toLocaleString() : 'Not verified'} />
                  </div>
                )}

                {activeTab === 'approvals' && result.verificationDetails?.approvals && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <InfoField label="Workflow Status" value={result.verificationDetails.approvals.status} />
                    <InfoField label="Current Step" value={`${result.verificationDetails.approvals.currentStep} / ${result.verificationDetails.approvals.totalSteps}`} />
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase' }}>Approval Steps</p>
                      {result.verificationDetails.approvals.steps.map((step: any, index: number) => (
                        <div key={index} style={{
                          padding: '12px',
                          background: step.status === 'approved' ? '#f0fdf4' : step.status === 'rejected' ? '#fef2f2' : '#f5efe8',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          border: `1px solid ${step.status === 'approved' ? '#10b981' : step.status === 'rejected' ? '#ef4444' : '#e8ddd0'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>Step {index + 1}: {step.role}</span>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              color: step.status === 'approved' ? '#065f46' : step.status === 'rejected' ? '#991b1b' : '#6b7280',
                              textTransform: 'uppercase',
                            }}>
                              {step.status}
                            </span>
                          </div>
                          {step.completedAt && (
                            <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
                              Completed: {new Date(step.completedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '32px', paddingBottom: '20px' }}>
          Powered by SmartTech Educational Intelligence Platform | Globally Verifiable Academic Credentials
        </p>
      </div>
    </div>
  );
}

function InfoField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 16px',
      background: '#f5efe8',
      borderRadius: '10px',
      gap: '16px',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{
        fontSize: '14px',
        color: '#1f2937',
        fontWeight: 600,
        textAlign: 'right',
        wordBreak: 'break-all',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value || '-'}
      </span>
    </div>
  );
}

function VerificationBadge({ label, valid }: { label: string; valid: boolean }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 16px',
      background: valid ? '#f0fdf4' : '#fef2f2',
      borderRadius: '10px',
      border: `2px solid ${valid ? '#10b981' : '#ef4444'}`,
    }}>
      <span style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className={`fa ${valid ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ fontSize: '18px', color: valid ? '#10b981' : '#ef4444' }}></i>
        <span style={{ fontSize: '13px', fontWeight: 700, color: valid ? '#065f46' : '#991b1b', textTransform: 'uppercase' }}>
          {valid ? 'VERIFIED' : 'NOT VERIFIED'}
        </span>
      </div>
    </div>
  );
}
