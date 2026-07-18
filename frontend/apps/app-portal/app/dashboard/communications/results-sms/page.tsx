'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { resultsSmsApi, classApi, termApi } from '@/lib/api';

export default function ResultsSmsPage() {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'history' | 'failed'>('preview');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);
  const [sendScope, setSendScope] = useState<'all' | 'selected'>('all');

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(res => res.data),
  });

  const { data: smsSettings } = useQuery({
    queryKey: ['results-sms-settings'],
    queryFn: () => resultsSmsApi.getSettings().then(res => res.data),
  });

  const {
    data: previewData,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: ['results-sms-preview', selectedClass, selectedTerm],
    queryFn: () => resultsSmsApi.preview(selectedClass, selectedTerm).then(res => res.data),
    enabled: !!selectedClass && !!selectedTerm,
  });

  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['results-sms-history', selectedClass, selectedTerm],
    queryFn: () => resultsSmsApi.getHistory(selectedClass || undefined, selectedTerm || undefined).then(res => res.data),
    enabled: activeTab === 'history',
  });

  const { data: failedData, refetch: refetchFailed } = useQuery({
    queryKey: ['results-sms-failed'],
    queryFn: () => resultsSmsApi.getFailedLogs().then(res => res.data),
    enabled: activeTab === 'failed',
  });

  const { data: batchLogs, refetch: refetchBatch } = useQuery({
    queryKey: ['results-sms-batch', expandedBatch],
    queryFn: () => resultsSmsApi.getBatchLogs(expandedBatch!).then(res => res.data),
    enabled: !!expandedBatch,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      resultsSmsApi.send({
        classId: selectedClass,
        termId: selectedTerm,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results-sms-history'] });
      queryClient.invalidateQueries({ queryKey: ['results-sms-preview'] });
    },
  });

  const [batchResult, setBatchResult] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSend = useCallback(async () => {
    setShowConfirm(false);
    sendMutation.mutate(undefined, {
      onSuccess: (res: any) => {
        setBatchResult(res);
      },
    });
  }, [sendMutation]);

  const handlePreviewRecipient = (parentId: string) => {
    setExpandedPreview(expandedPreview === parentId ? null : parentId);
  };

  const totalRecipients = previewData?.totalRecipients ?? 0;
  const validRecipients = previewData?.validRecipients ?? 0;
  const missingPhone = previewData?.missingPhone ?? 0;
  const invalidPhone = previewData?.invalidPhone ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Results SMS</h1>
          <p className="text-gray-600 mt-1">Send exam results to parents via SMS</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Send SMS
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('failed')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'failed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Failed Logs
          </button>
        </div>
      </div>

      {activeTab === 'preview' && (
        <>
          <div className="bg-white rounded-lg shadow p-6">
            {smsSettings && (
              <div className="mb-4 p-4 rounded-lg border" style={{ background: smsSettings.smsEnabled ? '#f0fdf4' : '#fef2f2' }}>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${smsSettings.smsEnabled ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="font-medium">{smsSettings.smsEnabled ? 'SMS is enabled' : 'SMS is disabled'}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    Provider: {smsSettings.smsProvider || 'Not set'} | Sender: {smsSettings.smsSenderId || 'Default'}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select class...</option>
                  {(Array.isArray(classes) ? classes : []).map((cls: any) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select term...</option>
                  {(Array.isArray(terms) ? terms : []).map((term: any) => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {previewLoading && (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                <div className="text-gray-600">Loading recipients...</div>
              </div>
            )}

            {previewData && !previewLoading && (
              <div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-700">{totalRecipients}</div>
                    <div className="text-sm text-blue-600">Total Recipients</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-700">{validRecipients}</div>
                    <div className="text-sm text-green-600">Ready to Send</div>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-700">{missingPhone}</div>
                    <div className="text-sm text-yellow-600">Missing Phone</div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-700">{invalidPhone}</div>
                    <div className="text-sm text-red-600">Invalid Number</div>
                  </div>
                </div>

                {validRecipients > 0 && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 font-medium">Preview: This is what parents will receive</p>
                    <p className="text-amber-700 text-sm mt-1">
                      SMS will be sent to {validRecipients} parent(s) with phone numbers on record.
                      {missingPhone > 0 && ` ${missingPhone} parent(s) missing phone numbers will be skipped.`}
                      {invalidPhone > 0 && ` ${invalidPhone} parent(s) with invalid numbers will be skipped.`}
                    </p>
                  </div>
                )}

                <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                  {previewData.recipients?.map((r: any) => (
                    <div key={r.parentId} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => handlePreviewRecipient(r.parentId)}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            r.phoneStatus === 'VALID' ? 'bg-green-500' :
                            r.phoneStatus === 'MISSING' ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <div className="font-medium">{r.parentName}</div>
                            <div className="text-sm text-gray-500">
                              {r.studentName} ({r.admissionNumber || 'N/A'})
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono">{r.phoneNumber || '-'}</div>
                          <div className={`text-xs ${
                            r.phoneStatus === 'VALID' ? 'text-green-600' :
                            r.phoneStatus === 'MISSING' ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {r.phoneStatus === 'VALID' ? 'Ready' : r.phoneStatus === 'MISSING' ? 'No Phone' : 'Invalid'}
                          </div>
                        </div>
                      </button>
                      {expandedPreview === r.parentId && (
                        <div className="p-4 bg-gray-50 border-t">
                          <div className="mb-2">
                            <div className="text-xs font-medium text-gray-500 mb-1">SMS Preview</div>
                            <pre className="bg-white p-3 rounded border text-sm whitespace-pre-wrap font-mono">{r.message}</pre>
                          </div>
                          {r.phoneStatus !== 'VALID' && r.errorSuggestion && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                              <strong>Fix:</strong> {r.errorSuggestion}
                            </div>
                          )}
                          <div className="mt-2 text-xs text-gray-500">
                            Average: {r.average}% | Total Points: {r.totalPoints} | GPA: {r.gpa ?? 'N/A'} | Rank: {r.classRank ? `#${r.classRank}` : 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {validRecipients > 0 && (
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={sendMutation.isPending}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                    >
                      {sendMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                          Sending...
                        </span>
                      ) : (
                        `Send SMS to ${validRecipients} Parent(s)`
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!selectedClass || !selectedTerm ? (
              <div className="text-center py-12 text-gray-500">
                Select a class and term to see recipients
              </div>
            ) : null}
          </div>

          {sendMutation.isPending && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
                <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Sending Results SMS...</h3>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${validRecipients > 0 ? Math.min(100, (sendMutation.data?.sent || 0) / validRecipients * 100) : 0}%` }}
                  ></div>
                </div>
                <div className="text-sm text-gray-600">
                  Sent: {sendMutation.data?.sent ?? 0} / {validRecipients}
                  {sendMutation.data && (
                    <>
                      <span className="ml-2">Failed: {sendMutation.data.failed}</span>
                      <span className="ml-2">Skipped: {sendMutation.data.skipped}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {batchResult && !sendMutation.isPending && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="text-center mb-6">
                  <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl ${
                    batchResult.failed === 0 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {batchResult.failed === 0 ? '✓' : '!'}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{batchResult.message}</h3>
                  <div className="flex justify-center gap-6 mt-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{batchResult.sent}</div>
                      <div className="text-gray-500">Sent</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{batchResult.failed}</div>
                      <div className="text-gray-500">Failed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{batchResult.skipped}</div>
                      <div className="text-gray-500">Skipped</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{batchResult.total}</div>
                      <div className="text-gray-500">Total</div>
                    </div>
                  </div>
                </div>

                {batchResult.logs?.filter((l: any) => l.status !== 'SENT').length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-bold text-gray-900 mb-3">Failed / Skipped Details</h4>
                    <div className="space-y-2">
                      {batchResult.logs.filter((l: any) => l.status !== 'SENT').map((log: any) => (
                        <div key={log.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-medium">{log.parentName}</div>
                              <div className="text-sm text-gray-600">{log.studentName} - {log.phoneNumber || 'No phone'}</div>
                              <div className="text-sm text-red-700 mt-1">{log.errorMessage}</div>
                              {log.errorSuggestion && (
                                <div className="text-sm text-amber-700 mt-1">
                                  <strong>Suggested fix:</strong> {log.errorSuggestion}
                                </div>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              log.status === 'FAILED' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                            }`}>
                              {log.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => { setBatchResult(null); setSelectedClass(''); setSelectedTerm(''); }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {showConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Send</h3>
                <p className="text-gray-600 mb-4">
                  Send results SMS to <strong>{validRecipients} parent(s)</strong>?
                  {missingPhone > 0 && (
                    <span className="block text-yellow-600 mt-2">
                      {missingPhone} parent(s) with missing phone numbers will be skipped.
                    </span>
                  )}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Each SMS will contain the full exam results breakdown for their child.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Send Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Sending History</h2>

          {!historyData || historyData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No SMS batches found</div>
          ) : (
            <div className="space-y-3">
              {historyData.map((batch: any) => (
                <div key={batch.batchId} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedBatch(expandedBatch === batch.batchId ? null : batch.batchId)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-500 font-mono">{batch.batchId}</div>
                      <div className="text-xs text-gray-400">{new Date(batch.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-bold">{batch.sent}</div>
                        <div className="text-xs text-green-600">Sent</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold">{batch.failed}</div>
                        <div className="text-xs text-red-600">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold">{batch.skipped}</div>
                        <div className="text-xs text-yellow-600">Skip</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-bold">{batch.total}</div>
                        <div className="text-xs text-gray-600">Total</div>
                      </div>
                      <span className="text-gray-400">{expandedBatch === batch.batchId ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {expandedBatch === batch.batchId && batchLogs && (
                    <div className="border-t bg-gray-50 p-4 max-h-80 overflow-y-auto">
                      {batchLogs.length === 0 ? (
                        <div className="text-gray-500 text-sm">Loading...</div>
                      ) : (
                        <div className="space-y-2">
                          {batchLogs.map((log: any) => (
                            <div key={log.id} className="flex items-start justify-between p-2 bg-white rounded border text-sm">
                              <div className="flex-1">
                                <div className="font-medium">{log.parentName}</div>
                                <div className="text-gray-500">{log.studentName} - {log.phoneNumber || 'No phone'}</div>
                                {log.errorMessage && (
                                  <div className="text-red-600 text-xs mt-0.5">{log.errorMessage}</div>
                                )}
                                {log.errorSuggestion && (
                                  <div className="text-amber-600 text-xs">{log.errorSuggestion}</div>
                                )}
                              </div>
                              <span className={`text-xs px-2 py-0.5 rounded ml-2 ${
                                log.status === 'SENT' ? 'bg-green-100 text-green-700' :
                                log.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {log.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'failed' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Failed / Skipped Logs</h2>

          {!failedData || failedData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No failed or skipped SMS records</div>
          ) : (
            <div className="space-y-3">
              {failedData.map((log: any) => (
                <div key={log.id} className="p-4 border rounded-lg bg-red-50/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{log.parentName}</div>
                      <div className="text-sm text-gray-600">{log.studentName} ({log.admissionNumber || 'N/A'})</div>
                      <div className="text-sm text-gray-500 font-mono">{log.phoneNumber || 'No phone number'}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      log.status === 'FAILED' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm">
                    <strong>Error:</strong> {log.errorMessage || 'Unknown'}
                  </div>
                  {log.errorSuggestion && (
                    <div className="mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      <strong>Recommended action:</strong> {log.errorSuggestion}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-gray-400">
                    Batch: {log.batchId} | {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
