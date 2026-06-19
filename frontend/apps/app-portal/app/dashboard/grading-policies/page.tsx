'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gradingEngineApi } from '@/lib/api';
import { toast } from 'sonner';
import { ReadOnlyBanner } from '@/components/permissions/ReadOnlyBanner';

export default function GradingPoliciesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    name: '',
    code: '',
    type: 'PERCENTAGE',
    isDefault: false,
    scales: [
      { minScore: 80, maxScore: 100, grade: 'A', remark: 'Excellent', points: 5, sortOrder: 1 },
      { minScore: 70, maxScore: 79, grade: 'B', remark: 'Very Good', points: 4, sortOrder: 2 },
      { minScore: 60, maxScore: 69, grade: 'C', remark: 'Good', points: 3, sortOrder: 3 },
      { minScore: 50, maxScore: 59, grade: 'D', remark: 'Satisfactory', points: 2, sortOrder: 4 },
      { minScore: 0, maxScore: 49, grade: 'F', remark: 'Fail', points: 0, sortOrder: 5 },
    ],
  });

  const { data: policies } = useQuery({
    queryKey: ['grading-policies'],
    queryFn: () => gradingEngineApi.policies.list().then(r => r.data?.data || r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => gradingEngineApi.policies.create(data).then(r => r.data?.data || r.data),
    onSuccess: () => {
      toast.success('Grading policy created');
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['grading-policies'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create policy');
    },
  });

  const seedMutation = useMutation({
    mutationFn: (type: string) => {
      switch (type) {
        case 'ecz': return gradingEngineApi.seed.ecz().then(r => r.data?.data || r.data);
        case 'gpa': return gradingEngineApi.seed.gpa().then(r => r.data?.data || r.data);
        case 'standard': return gradingEngineApi.seed.standard().then(r => r.data?.data || r.data);
        default: return Promise.reject(new Error('Unknown type'));
      }
    },
    onSuccess: () => {
      toast.success('Grading policy seeded');
      queryClient.invalidateQueries({ queryKey: ['grading-policies'] });
    },
  });

  const handleCreate = () => {
    createMutation.mutate(newPolicy);
  };

  const addScale = () => {
    setNewPolicy({
      ...newPolicy,
      scales: [...newPolicy.scales, {
        minScore: 0,
        maxScore: 100,
        grade: '',
        remark: '',
        points: 0,
        sortOrder: newPolicy.scales.length,
      }],
    });
  };

  const updateScale = (index: number, field: string, value: any) => {
    setNewPolicy({
      ...newPolicy,
      scales: newPolicy.scales.map((s, i) => i === index ? { ...s, [field]: value } : s),
    });
  };

  const removeScale = (index: number) => {
    setNewPolicy({
      ...newPolicy,
      scales: newPolicy.scales.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <ReadOnlyBanner managePermission="grading-policies.manage" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grading Policies</h1>
          <p className="text-gray-500 mt-1">Manage grading systems, scales, and point assignments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => seedMutation.mutate('ecz')}
            disabled={seedMutation.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            <i className="fa fa-flag mr-1"></i>Seed ECZ
          </button>
          <button
            onClick={() => seedMutation.mutate('gpa')}
            disabled={seedMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            <i className="fa fa-graduation-cap mr-1"></i>Seed GPA
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-sm"
          >
            <i className="fa fa-plus mr-1"></i>Create Policy
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Grading Policy</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={newPolicy.name}
                onChange={e => setNewPolicy({ ...newPolicy, name: e.target.value })}
                placeholder="e.g. Custom Grading System"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={newPolicy.code}
                onChange={e => setNewPolicy({ ...newPolicy, code: e.target.value })}
                placeholder="e.g. CUSTOM"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                value={newPolicy.type}
                onChange={e => setNewPolicy({ ...newPolicy, type: e.target.value })}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="POINTS">Points</option>
                <option value="GPA">GPA</option>
                <option value="ECZ_ZAMBIA">ECZ Zambia</option>
                <option value="PASS_FAIL">Pass/Fail</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Grade Scales</h4>
              <button
                onClick={addScale}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                <i className="fa fa-plus mr-1"></i>Add Scale
              </button>
            </div>

            <div className="space-y-2">
              {newPolicy.scales.map((scale, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-xs text-gray-400 w-4">{index + 1}</span>
                  <input
                    type="number"
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="Min"
                    value={scale.minScore}
                    onChange={e => updateScale(index, 'minScore', parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="number"
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="Max"
                    value={scale.maxScore}
                    onChange={e => updateScale(index, 'maxScore', parseFloat(e.target.value) || 0)}
                  />
                  <input
                    type="text"
                    className="w-12 border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="Grade"
                    value={scale.grade}
                    onChange={e => updateScale(index, 'grade', e.target.value)}
                  />
                  <input
                    type="text"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="Remark"
                    value={scale.remark}
                    onChange={e => updateScale(index, 'remark', e.target.value)}
                  />
                  <input
                    type="number"
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
                    placeholder="Points"
                    value={scale.points}
                    onChange={e => updateScale(index, 'points', parseFloat(e.target.value) || 0)}
                  />
                  <button
                    onClick={() => removeScale(index)}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !newPolicy.name || !newPolicy.code}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {policies?.map((policy: any) => (
          <div key={policy.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{policy.name}</h3>
              {policy.isDefault && (
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Default</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mb-3">Code: {policy.code} | Type: {policy.type}</p>
            <div className="space-y-1">
              {policy.scales?.map((scale: any) => (
                <div key={scale.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-600">{scale.minScore}-{scale.maxScore}%</span>
                  <span className="font-medium text-gray-900">{scale.grade}</span>
                  <span className="text-gray-500 text-xs">{scale.remark}</span>
                  <span className="text-blue-600 font-medium">{scale.points} pts</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(!policies || policies.length === 0) && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <i className="fa fa-graduation-cap text-4xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">No grading policies yet. Click &quot;Seed ECZ&quot; or &quot;Create Policy&quot; to begin.</p>
        </div>
      )}
    </div>
  );
}
