'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BlockchainVerifyPage() {
  const [transactionHash, setTransactionHash] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!transactionHash.trim()) {
      setError('Please enter a transaction hash.');
      return;
    }

    try {
      setVerifying(true);
      setError('');
      setResult(null);

      const response = await fetch(`${API_BASE_URL}/blockchain/verify/${transactionHash.trim()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError('Blockchain verification failed.');
      }
    } catch (err: any) {
      setError('Verification failed. Please check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '20px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
      `}</style>

      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
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
            <i className="fa fa-link" style={{ fontSize: '36px', color: '#667eea' }}></i>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'white', margin: '0 0 8px' }}>
            Blockchain Verification
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            Verify certificate hashes on the blockchain
          </p>
        </motion.div>

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
            Transaction Hash
          </label>
          <input
            value={transactionHash}
            onChange={(e) => setTransactionHash(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            placeholder="0x..."
            style={{
              width: '100%',
              padding: '14px 18px',
              borderRadius: '12px',
              border: '2px solid #e8ddd0',
              fontSize: '14px',
              fontFamily: 'monospace',
              outline: 'none',
              marginBottom: '16px',
            }}
          />
          <button
            onClick={handleVerify}
            disabled={verifying}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: verifying ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontSize: '15px',
              fontWeight: 700,
              cursor: verifying ? 'not-allowed' : 'pointer',
            }}
          >
            {verifying ? 'Verifying...' : 'Verify on Blockchain'}
          </button>

          {verifying && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <div className="spinner" style={{ margin: '0 auto' }}></div>
            </div>
          )}
        </motion.div>

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
              }}
            >
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b', margin: '0 0 4px' }}>Verification Failed</p>
              <p style={{ fontSize: '14px', color: '#dc2626', margin: 0 }}>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                background: '#fefcf9',
                borderRadius: '20px',
                padding: '28px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{
                padding: '20px',
                background: result.verified ? '#f0fdf4' : '#fef2f2',
                borderRadius: '12px',
                marginBottom: '20px',
                textAlign: 'center',
              }}>
                <i className={`fa ${result.verified ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ fontSize: '48px', color: result.verified ? '#10b981' : '#ef4444' }}></i>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#1f2937', margin: '12px 0 4px' }}>
                  {result.verified ? 'Blockchain Verified' : 'Not Found on Blockchain'}
                </h2>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                  Network: {result.network}
                </p>
              </div>

              <div style={{
                padding: '14px 16px',
                background: '#f5efe8',
                borderRadius: '10px',
                marginBottom: '12px',
              }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#6b7280', margin: '0 0 6px', textTransform: 'uppercase' }}>Transaction Hash</p>
                <p style={{ fontSize: '13px', color: '#1f2937', fontFamily: 'monospace', wordBreak: 'break-all', margin: 0 }}>
                  {result.transactionHash}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '32px', paddingBottom: '20px' }}>
          Powered by SmartTech Blockchain Verification System
        </p>
      </div>
    </div>
  );
}
