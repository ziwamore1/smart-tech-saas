'use client';

import { useState } from 'react';
import { digitalStampApi } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';

export default function VerifyPage() {
  const [inputHash, setInputHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  const handleVerify = async () => {
    if (!inputHash.trim()) return;
    setLoading(true);
    try {
      const res = await digitalStampApi.verifyDocument(inputHash.trim());
      const verificationResult = res.data;
      setResult(verificationResult);
      setHistory(prev => [verificationResult, ...prev].slice(0, 10));
    } catch (err: any) {
      setResult({ valid: false, message: err?.response?.data?.message || 'Document could not be verified' });
    } finally {
      setLoading(false);
    }
  };

  const isVerified = result?.valid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Verification</h1>
        <p className="text-sm text-gray-500 mt-1">Verify the authenticity of stamped documents</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Verification Hash</h2>
        <p className="text-sm text-gray-500 mb-4">Enter the hash from a stamped document</p>

        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-none"
          rows={3}
          value={inputHash}
          onChange={e => setInputHash(e.target.value)}
          placeholder="Paste verification hash here..."
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { setInputHash(''); setResult(null); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={handleVerify}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Verifying...
              </span>
            ) : 'Verify Document'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`rounded-xl border p-6 ${isVerified ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${isVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isVerified ? '✓' : '✕'}
            </div>
            <div>
              <h3 className={`text-lg font-bold ${isVerified ? 'text-green-800' : 'text-red-800'}`}>
                {isVerified ? 'Document Verified' : 'Verification Failed'}
              </h3>
              <p className="text-sm text-gray-600">{result.message || (isVerified ? 'This document is authentic' : 'Document could not be verified')}</p>
            </div>
          </div>

          {isVerified && result.documentId && (
            <div className="bg-white/70 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Document Type</span>
                  <p className="font-medium text-gray-900">{result.documentType || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">School</span>
                  <p className="font-medium text-gray-900">{result.schoolName || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Stamp</span>
                  <p className="font-medium text-gray-900">{result.stampName || 'N/A'} ({result.stampType})</p>
                </div>
                <div>
                  <span className="text-gray-500">Applied By</span>
                  <p className="font-medium text-gray-900">{result.appliedBy || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Applied At</span>
                  <p className="font-medium text-gray-900">{result.appliedAt ? new Date(result.appliedAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              {result.auditTrail && result.auditTrail.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Approval Trail</h4>
                  <div className="space-y-2">
                    {result.auditTrail.map((entry: any, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5" />
                        <div>
                          <p className="font-medium text-gray-900">{entry.action}</p>
                          <p className="text-gray-500">{entry.user} • {new Date(entry.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-center">
                <div className="bg-white p-3 rounded-lg">
                  <QRCodeSVG value={inputHash} size={150} />
                  <p className="text-xs text-gray-500 text-center mt-2">Scan to verify</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {history.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Verifications</h3>
          <div className="space-y-2">
            {history.slice(1).map((item, i) => (
              <button
                key={i}
                onClick={() => { setInputHash(item.documentId || ''); setResult(item); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 text-left"
              >
                <div className={`w-2 h-2 rounded-full ${item.valid ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.documentType || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{item.documentId?.substring(0, 12)}...</p>
                </div>
                <span className={`text-xs font-semibold ${item.valid ? 'text-green-600' : 'text-red-600'}`}>
                  {item.valid ? 'Verified' : 'Failed'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
