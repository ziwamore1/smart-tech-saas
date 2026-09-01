'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assessmentEngineApi, classApi, subjectApi, termApi } from '@/lib/api';
import { toast } from 'sonner';

export default function AssessmentConfigPage() {
  const queryClient = useQueryClient();

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [configs, setConfigs] = useState<Array<{
    assessmentDefId: string;
    maxScore: number;
    weightPercentage: number;
    mandatory: boolean;
    sequenceOrder: number;
  }>>([]);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: terms } = useQuery({
    queryKey: ['terms'],
    queryFn: () => termApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data?.data || r.data),
  });

  const { data: assessmentDefs } = useQuery({
    queryKey: ['assessment-defs'],
    queryFn: () => assessmentEngineApi.definitions.list().then(r => r.data?.data || r.data),
  });

  const { data: existingConfigs } = useQuery({
    queryKey: ['assessment-configs', selectedClass, selectedSubject, selectedTerm],
    queryFn: () =>
      assessmentEngineApi.configurations.get(selectedClass, selectedSubject, selectedTerm).then(
        r => r.data?.data || r.data
      ),
    enabled: !!(selectedClass && selectedSubject && selectedTerm),
  });

  React.useEffect(() => {
    if (existingConfigs) {
      setConfigs(existingConfigs.map((c: any) => ({
        assessmentDefId: c.assessmentDefId,
        maxScore: c.maxScore,
        weightPercentage: c.weightPercentage,
        mandatory: c.mandatory,
        sequenceOrder: c.sequenceOrder,
      })));
    } else {
      setConfigs([]);
    }
  }, [existingConfigs]);

  const configureMutation = useMutation({
    mutationFn: (data: any) =>
      assessmentEngineApi.configurations.configure(data).then(r => r.data?.data || r.data),
    onSuccess: () => {
      toast.success('Assessment configuration saved');
      queryClient.invalidateQueries({ queryKey: ['assessment-configs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save configuration');
    },
  });

  const handleSave = () => {
    if (!selectedClass || !selectedSubject || !selectedTerm) {
      toast.error('Please select class, subject, and term');
      return;
    }

    const hasEmptyDef = configs.some(c => !c.assessmentDefId);
    if (hasEmptyDef) {
      toast.error('Please select an assessment type for all entries');
      return;
    }

    // When every component assessment for this subject has been removed, send
    // an empty configuration list so the backend reverts the subject to a
    // single End of Term (or Mid-Term) assessment at 100% weight.
    let payload = configs;

    if (configs.length === 0) {
      const fallback = assessmentDefs?.find((d: any) =>
        d.active !== false && ['END_TERM', 'MID_TERM'].includes(d.examType)
      );
      if (fallback) {
        toast.info(`No assessments configured — reverting to single ${fallback.name} at 100%.`);
        payload = [{
          assessmentDefId: fallback.id,
          maxScore: fallback.defaultMaxScore || 100,
          weightPercentage: 100,
          mandatory: true,
          sequenceOrder: 0,
        }];
      } else {
        toast.error('All assessments were removed but no End of Term / Mid-Term assessment type exists to revert to. Please add an assessment.');
        return;
      }
    } else {
      const totalWeight = configs.reduce((sum, c) => sum + c.weightPercentage, 0);
      if (totalWeight !== 100) {
        toast.warning(`Total weight is ${totalWeight}% (expected 100%). Saving anyway.`);
      }
    }

    configureMutation.mutate({
      classId: selectedClass,
      subjectId: selectedSubject,
      termId: selectedTerm,
      configurations: payload,
    });
  };

  const addAssessment = () => {
    setConfigs([...configs, {
      assessmentDefId: '',
      maxScore: 100,
      weightPercentage: 0,
      mandatory: false,
      sequenceOrder: configs.length,
    }]);
  };

  const removeAssessment = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index));
  };

  const updateConfig = (index: number, field: string, value: any) => {
    setConfigs(configs.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const totalWeight = configs.reduce((sum, c) => sum + c.weightPercentage, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Assessment Configuration</h1>
        <p className="text-gray-500 mt-1">Configure assessment types and weightings per class, subject, and term.</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedClass}
              onChange={e => setSelectedClass(e.target.value)}
            >
              <option value="">Select Class</option>
              {classes?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option value="">Select Subject</option>
              {subjects?.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={selectedTerm}
              onChange={e => setSelectedTerm(e.target.value)}
            >
              <option value="">Select Term</option>
              {terms?.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedClass && selectedSubject && selectedTerm && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assessment Weightings</h3>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {totalWeight}%
                </span>
                <button
                  onClick={addAssessment}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <i className="fa fa-plus mr-1"></i>Add Assessment
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {configs.map((config, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-500 w-6">{index + 1}</span>

                  <div className="flex-1">
                    <select
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      value={config.assessmentDefId}
                      onChange={e => updateConfig(index, 'assessmentDefId', e.target.value)}
                    >
                      <option value="">Select Assessment Type</option>
                      {assessmentDefs?.map((d: any) => (
                        <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Max"
                      value={config.maxScore}
                      onChange={e => updateConfig(index, 'maxScore', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="Weight %"
                      value={config.weightPercentage}
                      onChange={e => updateConfig(index, 'weightPercentage', parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="w-24">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={config.mandatory}
                        onChange={e => updateConfig(index, 'mandatory', e.target.checked)}
                      />
                      Mandatory
                    </label>
                  </div>

                  <button
                    onClick={() => removeAssessment(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                  >
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              ))}

              {configs.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <i className="fa fa-cog text-3xl mb-2"></i>
                  <p>No assessments configured for this subject.</p>
                  <p className="text-sm">Click &quot;Update Configuration&quot; to revert to a single End of Term / Mid-Term assessment at 100%, or use &quot;Add Assessment&quot; to build a custom weighting.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={configureMutation.isPending}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {configureMutation.isPending ? (
                  <><i className="fa fa-spinner fa-spin mr-1"></i>Updating...</>
                ) : (
                  <><i className="fa fa-pen mr-1"></i>Update Configuration</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
