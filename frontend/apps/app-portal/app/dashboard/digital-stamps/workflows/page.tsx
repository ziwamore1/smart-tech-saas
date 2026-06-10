'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { digitalStampApi } from '@/lib/api';
import type { ApprovalWorkflow } from '@/types/stamps';

export default function WorkflowsPage() {
  const { user } = useAuth();
  const isDirector = user?.roles?.includes('Director') || user?.roles?.includes('Head Teacher');
  const isAdmin = user?.roles?.includes('Deputy');

  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const res = await digitalStampApi.getApprovalWorkflows();
      const data = res.data?.workflows ?? res.data ?? [];
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessStep = async (workflowId: string, stepId: string, approve: boolean) => {
    setProcessing(true);
    try {
      await digitalStampApi.processApprovalStep(workflowId, stepId, {
        approved: approve,
        note: note.trim() || undefined,
      });
      setNote('');
      alert(approve ? 'Step approved' : 'Step rejected');
      setShowDetailModal(false);
      loadWorkflows();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to process step');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  const filteredWorkflows = workflows.filter(w => {
    if (filter === 'pending') return w.status === 'pending' || w.status === 'in_progress';
    if (filter === 'completed') return w.status === 'completed' || w.status === 'rejected';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approval Workflows</h1>
        <p className="text-sm text-gray-500 mt-1">Track document approval chains</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all', 'pending', 'completed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filteredWorkflows.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 font-medium">No approval workflows</p>
          <p className="text-sm text-gray-400 mt-1">Create a workflow when submitting a document for approval</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkflows.map(workflow => (
            <div
              key={workflow.id}
              className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setSelectedWorkflow(workflow); setShowDetailModal(true); }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{workflow.documentName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{workflow.documentType}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Created by {workflow.createdByName} • {new Date(workflow.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  workflow.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  workflow.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  workflow.status === 'completed' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {workflow.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center">
                  {workflow.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        step.status === 'approved' ? 'bg-green-500 text-white' :
                        step.status === 'rejected' ? 'bg-red-500 text-white' :
                        i === workflow.currentStep ? 'bg-blue-500 text-white' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {step.status === 'approved' ? '✓' : step.status === 'rejected' ? '✕' : i + 1}
                      </div>
                      {i < workflow.steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 ${step.status === 'approved' ? 'bg-green-500' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-1">
                  Step {workflow.currentStep + 1} of {workflow.steps.length}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedWorkflow && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Workflow Details</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedWorkflow.documentName} • {selectedWorkflow.documentType}</p>

            <div className="space-y-3 mb-6">
              {selectedWorkflow.steps.map((step, i) => (
                <div key={step.id} className={`flex items-center gap-3 p-3 rounded-lg ${i === selectedWorkflow.currentStep ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step.status === 'approved' ? 'bg-green-500 text-white' :
                    step.status === 'rejected' ? 'bg-red-500 text-white' :
                    i === selectedWorkflow.currentStep ? 'bg-blue-500 text-white' :
                    'bg-gray-300 text-gray-600'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{step.role}</p>
                    <p className="text-xs text-gray-500">{step.userName || 'Pending assignment'}</p>
                    {step.note && <p className="text-xs text-blue-600 italic mt-0.5">Note: {step.note}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    step.status === 'approved' ? 'bg-green-100 text-green-800' :
                    step.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {step.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>

            {selectedWorkflow.status === 'in_progress' && isDirector && (
              <>
                <label className="text-sm font-medium text-gray-700">Approval Note:</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none mt-1 mb-4"
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add approval note (optional)..."
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const currentStep = selectedWorkflow.steps[selectedWorkflow.currentStep];
                      handleProcessStep(selectedWorkflow.id, currentStep.id, false);
                    }}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      const currentStep = selectedWorkflow.steps[selectedWorkflow.currentStep];
                      handleProcessStep(selectedWorkflow.id, currentStep.id, true);
                    }}
                    disabled={processing}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Processing...
                      </span>
                    ) : 'Approve'}
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setShowDetailModal(false)}
              className="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
