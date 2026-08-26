'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { digitalStampApi, stampEngineApi } from '@/lib/api';
import { DigitalStamp, StampPreview } from '@/components/stamps/DigitalStamp';
import type { DigitalStamp as StampType, DocumentStamp, ApprovalRequest, StampConfig } from '@/types/stamps';
import { STAMP_COLORS } from '@/types/stamps';

export default function DigitalStampsPage() {
  const { user } = useAuth();
  const userRoles = user?.allRoles || user?.roles || [];
  const isDirector = userRoles.some((r: string) => ['Director', 'Deputy Director', 'Head Teacher', 'Deputy Head'].includes(r));
  const isClassTeacher = userRoles.some((r: string) => ['Class Teacher', 'ClassTeacher'].includes(r));
  const isAdmin = userRoles.some((r: string) => ['Deputy', 'HOD', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'].includes(r));

  const [activeTab, setActiveTab] = useState<'stamps' | 'documents' | 'approvals'>('stamps');
  const [stamps, setStamps] = useState<StampType[]>([]);
  const [engineTemplates, setEngineTemplates] = useState<any[]>([]);
  const [stampedDocs, setStampedDocs] = useState<DocumentStamp[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [stampsRes, templatesRes, docsRes, approvalsRes] = await Promise.allSettled([
        digitalStampApi.getStamps(),
        stampEngineApi.listTemplates(),
        digitalStampApi.getStampedDocuments(),
        (isDirector || isAdmin) ? digitalStampApi.getApprovalRequests() : Promise.resolve({ data: [] }),
      ]);

      if (stampsRes.status === 'fulfilled') {
        const data = stampsRes.value.data?.stamps ?? stampsRes.value.data ?? [];
        setStamps(Array.isArray(data) ? data : []);
      }
      if (templatesRes.status === 'fulfilled') {
        const data = templatesRes.value.data?.templates ?? templatesRes.value.data ?? [];
        setEngineTemplates(Array.isArray(data) ? data.filter((template: any) => template.status === 'PUBLISHED') : []);
      }
      if (docsRes.status === 'fulfilled') {
        const data = docsRes.value.data?.documents ?? docsRes.value.data ?? [];
        setStampedDocs(Array.isArray(data) ? data : []);
      }
      if (approvalsRes.status === 'fulfilled') {
        const data = approvalsRes.value.data?.requests ?? approvalsRes.value.data ?? [];
        setApprovalRequests(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load stamp data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationInput.trim()) return;
    try {
      const res = await digitalStampApi.verifyDocument(verificationInput.trim());
      setVerificationResult(res.data);
    } catch (err: any) {
      setVerificationResult({ valid: false, message: err?.response?.data?.message || 'Invalid hash' });
    }
  };

  const handleApproveRequest = async (requestId: string, approve: boolean) => {
    try {
      await digitalStampApi.approveDocument(requestId, { approved: approve });
      alert(approve ? 'Document approved' : 'Document rejected');
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to process request');
    }
  };

  const tabs = [
    { key: 'stamps' as const, label: 'Stamps', icon: '🔏' },
    { key: 'documents' as const, label: 'Stamped Docs', icon: '📄' },
    ...(isDirector || isAdmin ? [{ key: 'approvals' as const, label: 'Approvals', icon: '✅' }] : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Stamps</h1>
          <p className="text-sm text-gray-500 mt-1">Manage stamps, verify documents, and approve workflows</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/digital-stamps/issue" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            📜 Issue Document
          </Link>
          <Link href="/dashboard/digital-stamps/designer" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            🎨 Stamp Designer
          </Link>
          <Link href="/dashboard/digital-stamps/apply" className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            🔏 Apply Stamp
          </Link>
          <Link href="/dashboard/digital-stamps/verify" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            🔍 Verify
          </Link>
          <Link href="/dashboard/digital-stamps/workflows" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            ✅ Workflows
          </Link>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stamps' && (
        <div>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Stamp Designer Templates</h2>
                <p className="text-sm text-gray-500">Published templates created in Stamp Designer</p>
              </div>
              <span className="text-sm text-gray-500">{engineTemplates.length} templates</span>
            </div>
            {engineTemplates.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-500 font-medium">No published designer templates</p>
                <p className="text-sm text-gray-400 mt-1">Publish a design and set it as Default to apply it to generated documents.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {engineTemplates.map(template => (
                  <div key={template.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{template.name}</p>
                        <p className="text-xs text-gray-500 mt-1">Version {template.version}</p>
                      </div>
                      {template.isDefault && <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Default</span>}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Link href="/dashboard/digital-stamps/designer" className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50">Edit in Designer</Link>
                      <Link href={`/dashboard/digital-stamps/issue?templateId=${template.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Use Template</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Available Stamps</h2>
            <span className="text-sm text-gray-500">{stamps.length} stamps</span>
          </div>

          {stamps.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">🔏</div>
              <p className="text-gray-500 font-medium">No stamps available</p>
              {isDirector && <p className="text-sm text-gray-400 mt-1">Upload institutional stamps from admin panel</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stamps.map(stamp => (
                <StampPreview key={stamp.id} config={{
                  id: stamp.id,
                  name: stamp.name,
                  title: (stamp.metadata as any)?.title,
                  schoolName: (stamp.metadata as any)?.schoolName,
                  type: (stamp.type?.toLowerCase() as any) || 'official',
                  imageUrl: stamp.imageUrl,
                  svgContent: stamp.svgContent,
                }} />
              ))}
            </div>
          )}

          {isClassTeacher && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <span className="text-xl">ℹ️</span>
              <div>
                <p className="text-sm text-blue-800 font-medium">Class Teacher Access</p>
                <p className="text-sm text-blue-700 mt-1">
                  You can preview stamped reports and request approvals. Only Directors can apply official institutional stamps.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Stamped Documents</h2>
            <span className="text-sm text-gray-500">{stampedDocs.length} documents</span>
          </div>

          {stampedDocs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-gray-500 font-medium">No stamped documents</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stamp</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applied By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stampedDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{doc.documentType}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <DigitalStamp
                            config={{ id: doc.stampId, name: doc.stampName, type: doc.stampType as any }}
                            width={40}
                            height={40}
                          />
                          <span className="text-sm text-gray-600">{doc.stampName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{doc.appliedByName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{new Date(doc.appliedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                          doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {doc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-gray-500 font-mono">{doc.verificationHash.substring(0, 16)}...</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'approvals' && (isDirector || isAdmin) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Approval Requests</h2>
            <span className="text-sm text-gray-500">
              {approvalRequests.filter(r => r.status === 'pending').length} pending
            </span>
          </div>

          {approvalRequests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-gray-500 font-medium">No approval requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvalRequests.map(req => (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{req.documentName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{req.documentType}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Requested by {req.requestedByName} • {new Date(req.requestedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      req.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleApproveRequest(req.id, false)}
                        className="px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveRequest(req.id, true)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-gray-600 flex items-center justify-center z-50 p-4" onClick={() => { setShowVerifyModal(false); setVerificationResult(null); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Verify Document</h3>
            <p className="text-sm text-gray-500 mb-4">Enter the verification hash from the stamped document</p>

            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono resize-none"
              rows={3}
              value={verificationInput}
              onChange={e => setVerificationInput(e.target.value)}
              placeholder="Paste verification hash..."
            />

            {verificationResult && (
              <div className={`mt-4 p-4 rounded-lg ${verificationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${verificationResult.valid ? 'text-green-700' : 'text-red-700'}`}>
                    {verificationResult.valid ? '✓' : '✕'}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${verificationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                      {verificationResult.valid ? 'Document Verified' : 'Verification Failed'}
                    </p>
                    {verificationResult.message && (
                      <p className="text-xs text-gray-600 mt-0.5">{verificationResult.message}</p>
                    )}
                    {verificationResult.valid && (
                      <>
                        <p className="text-xs text-gray-600 mt-1">Type: {verificationResult.documentType}</p>
                        <p className="text-xs text-gray-600">Stamped by: {verificationResult.appliedBy}</p>
                        <p className="text-xs text-gray-600">Date: {verificationResult.appliedAt ? new Date(verificationResult.appliedAt).toLocaleDateString() : 'N/A'}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setShowVerifyModal(false); setVerificationResult(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={handleVerify}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
