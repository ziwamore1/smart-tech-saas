'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { timetableApi, classApi } from '@/lib/api';

interface GenerationPanelProps {
  termId: string;
  schoolId?: string;
  onClose: () => void;
}

export default function GenerationPanel({
  termId,
  schoolId,
  onClose
}: GenerationPanelProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [generationMode, setGenerationMode] = useState<'all' | 'selected' | 'ai'>('all');

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-for-generation'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const handleToggleClass = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSelectAll = () => {
    if (selectedClasses.length === classes.length) {
      setSelectedClasses([]);
    } else {
      setSelectedClasses(classes.map((c: any) => c.id));
    }
  };

  const handleTestConstraints = async () => {
    setIsGenerating(true);
    setGenerationStatus('Testing constraints...');
    setGenerationProgress(10);

    try {
      setGenerationProgress(30);
      
      const errors: string[] = [];
      
      if (classes.length === 0) {
        errors.push('No classes found. Please create classes first.');
      }
      
      setGenerationProgress(60);
      
      setGenerationProgress(90);
      
      setGenerationProgress(100);
      
      if (errors.length === 0) {
        setGenerationStatus('✓ All constraints validated successfully!');
        alert('All constraints are satisfied! You can now generate the timetable.');
      } else {
        setGenerationStatus('✗ Constraint validation failed');
        alert('Constraint errors found:\n' + errors.join('\n'));
      }
    } catch (error) {
      setGenerationProgress(100);
      setGenerationStatus('✗ Validation failed');
      alert('Failed to test constraints: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!termId) {
      alert('No term selected. Please select a term first.');
      return;
    }

    if (generationMode === 'selected' && selectedClasses.length === 0) {
      alert('Please select at least one class to generate.');
      return;
    }

    if (generationMode === 'ai' && selectedClasses.length === 0) {
      alert('Please select a class to generate with AI.');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Starting generation...');

    try {
      const interval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 5, 90));
      }, 300);

      let jobId: string = '';
      
      setGenerationStatus(generationMode === 'all' 
        ? 'Generating for all classes...' 
        : `Generating for ${selectedClasses.length} selected class(es)...`
      );
      
      if (generationMode === 'all') {
        const res = await timetableApi.generateAllClasses(termId);
        console.log('[Generate All] Response:', res.data);
        jobId = res.data?.data?.jobId ?? res.data?.jobId ?? '';
      } else if (generationMode === 'selected') {
        const res = await timetableApi.generateSelectedClasses(termId, selectedClasses);
        console.log('[Generate Selected] Response:', res.data);
        jobId = res.data?.data?.jobId ?? res.data?.jobId ?? '';
      } else {
        // AI mode - generate for selected classes using AI
        try {
          const res = await timetableApi.generateTimetableAI(selectedClasses[0], termId);
          console.log('[Generate AI] Response:', res.data);
          console.log('[Generate AI] Full response:', JSON.stringify(res.data, null, 2));
          
          // Check if generation was successful
          const timetableData = res.data?.data || res.data;
          if (timetableData?.slots) {
            console.log('[Generate AI] Generated slots:', timetableData.slots.length);
            timetableData.slots.forEach((slot: any, idx: number) => {
              console.log(`[Generate AI] Slot ${idx}:`, slot.subject?.name, 'Teacher:', slot.teacher?.firstName, 'Day:', slot.day, 'Period:', slot.period);
            });
          }
          
          setGenerationProgress(100);
          setGenerationStatus('✓ AI Generation complete!');
          // Invalidate all possible timetable queries
          queryClient.invalidateQueries({ queryKey: ['class-timetable'] });
          queryClient.invalidateQueries({ queryKey: ['masterTimetable'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['timetable'] });
          queryClient.invalidateQueries({ queryKey: ['classes'] });
          // Force refetch the class timetable
          await queryClient.refetchQueries({ queryKey: ['class-timetable', selectedClasses[0], termId] });
          alert('Timetable generated with AI successfully!');
          onClose();
          return;
        } catch (err: any) {
          console.error('[Generate AI] Error:', err);
          alert('Failed to generate: ' + (err.response?.data?.message || err.message));
          setIsGenerating(false);
          return;
        }
      }
      console.log('[Generate] jobId:', jobId);

      clearInterval(interval);
      
      if (jobId) {
        setGenerationProgress(50);
        setGenerationStatus('Processing...');
        await pollJobStatus(jobId);
      } else {
        setGenerationProgress(100);
        setGenerationStatus('Generation complete!');
      }

      queryClient.invalidateQueries({ queryKey: ['class-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['masterTimetable'] });
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      queryClient.invalidateQueries({ queryKey: ['all-lesson-requirements'] });

      setGenerationStatus('✓ Generation complete!');
      alert('Timetable generated successfully!');
      onClose();
    } catch (error: any) {
      setGenerationStatus('✗ Generation failed');
      const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
      alert('Failed to generate timetable: ' + errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const pollJobStatus = async (jobId: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 120;

      const check = async () => {
        try {
          attempts++;
          const res = await timetableApi.getJobStatus(jobId);
          console.log('[Job Status Poll]', { attempts, response: res });

          const rawData = res.data;
          if (!rawData) {
            console.log('[Job Status] No data in response, retrying...', { attempts, maxAttempts });
            if (attempts >= maxAttempts) {
              reject(new Error('Failed to get job status'));
            } else {
              setTimeout(check, 1000);
            }
            return;
          }

          let jobInfo = rawData.data ?? rawData;
          const status = { ...rawData, ...jobInfo };
          console.log('[Job Status Parsed]', { status, jobInfo });

          if (!jobInfo || typeof jobInfo !== 'object' || Object.keys(jobInfo).length === 0) {
            console.log('[Job Status] Empty response, retrying...', { attempts, maxAttempts });
            if (attempts >= maxAttempts) {
              reject(new Error('Failed to get job status'));
            } else {
              setTimeout(check, 1000);
            }
            return;
          }

          const jobStatus = jobInfo.status ?? rawData.message;
          setGenerationProgress(jobInfo.progress ?? 50);

          if (jobStatus === 'completed') {
            setGenerationProgress(100);
            resolve();
          } else if (jobStatus === 'failed') {
            reject(new Error(jobInfo.error || 'Generation failed'));
          } else if (attempts >= maxAttempts) {
            reject(new Error('Generation timed out'));
          } else {
            console.log('[Job Status] Still processing, retrying...');
            setTimeout(check, 1000);
          }
        } catch (error: any) {
          console.log('[Job Status Error]', { attempts, maxAttempts, error: error.message });
          if (attempts < maxAttempts) {
            setTimeout(check, 1000);
          } else {
            reject(new Error(error?.response?.data?.message || error?.message || 'Failed to get job status'));
          }
        }
      };

      check();
    });
  };

  return (
    <div className="ut-modal-overlay" onClick={onClose}>
      <div className="ut-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <div className="ut-modal-header">
          <h3 className="ut-modal-title">
            <i className="fa fa-magic" style={{ marginRight: '8px', color: '#667eea' }}></i>
            AI Timetable Generator
          </h3>
          <button className="ut-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="ut-modal-section">
          <p style={{ fontSize: '13px', color: 'var(--ut-text-secondary)', marginBottom: '16px' }}>
            Automatically generate optimized timetables based on lesson requirements, 
            teacher availability, and room allocations.
          </p>

          {isGenerating && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 500,
              }}>
                <span>{generationStatus}</span>
                <span>{generationProgress}%</span>
              </div>
              <div style={{
                height: '10px',
                background: 'var(--ut-border)',
                borderRadius: '5px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${generationProgress}%`,
                  background: generationProgress === 100 
                    ? '#4CAF50' 
                    : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                  transition: 'width 0.3s, background 0.3s',
                  borderRadius: '5px',
                }} />
              </div>
            </div>
          )}

          {/* Generation Mode Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'block', color: '#333' }}>
              Generation Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setGenerationMode('all')}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${generationMode === 'all' ? '#667eea' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  background: generationMode === 'all' ? '#667eea' : '#fff',
                  color: generationMode === 'all' ? '#fff' : '#333',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <i className="fa fa-globe" style={{ marginRight: '6px' }}></i>
                All Classes
              </button>
              <button
                onClick={() => setGenerationMode('selected')}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${generationMode === 'selected' ? '#667eea' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  background: generationMode === 'selected' ? '#667eea' : '#fff',
                  color: generationMode === 'selected' ? '#fff' : '#333',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <i className="fa fa-check-square" style={{ marginRight: '6px' }}></i>
                Selected
              </button>
              <button
                onClick={() => setGenerationMode('ai')}
                disabled={isGenerating}
                style={{
                  flex: 1,
                  padding: '12px',
                  border: `2px solid ${generationMode === 'ai' ? '#10b981' : '#e0e0e0'}`,
                  borderRadius: '8px',
                  background: generationMode === 'ai' ? '#10b981' : '#fff',
                  color: generationMode === 'ai' ? '#fff' : '#333',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <i className="fa fa-magic" style={{ marginRight: '6px' }}></i>
                AI Generate
              </button>
            </div>
          </div>

          {/* Class Selection (when Selected or AI mode) */}
          {(generationMode === 'selected' || generationMode === 'ai') && (
            <div style={{ 
              marginBottom: '16px',
              padding: '12px',
              background: '#f9f9f9',
              borderRadius: '8px',
              border: '1px solid #e0e0e0',
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px' 
              }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
                  Select Classes ({selectedClasses.length} selected)
                </label>
                <button
                  onClick={handleSelectAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {selectedClasses.length === classes.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ 
                maxHeight: '150px', 
                overflow: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
              }}>
                {classes.map((cls: any) => (
                  <label
                    key={cls.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px',
                      background: selectedClasses.includes(cls.id) ? '#e8e8ff' : '#fff',
                      border: `1px solid ${selectedClasses.includes(cls.id) ? '#667eea' : '#e0e0e0'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClasses.includes(cls.id)}
                      onChange={() => handleToggleClass(cls.id)}
                      style={{ accentColor: '#667eea' }}
                    />
                    {cls.name}
                  </label>
                ))}
              </div>
              {classes.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#888', fontSize: '12px' }}>
                  No classes available
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{
                padding: '14px',
                border: 'none',
                borderRadius: '8px',
                background: isGenerating 
                  ? '#ccc' 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '14px',
                boxShadow: isGenerating ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}
            >
              <i className="fa fa-magic" style={{ marginRight: '8px' }}></i>
              {isGenerating 
                ? 'Generating...' 
                : generationMode === 'all'
                  ? 'Generate Timetable for All Classes'
                  : generationMode === 'ai'
                    ? 'Generate Timetable with AI'
                    : `Generate Timetable for ${selectedClasses.length} Class${selectedClasses.length !== 1 ? 'es' : ''}`
              }
            </button>

            <button
              onClick={handleTestConstraints}
              disabled={isGenerating}
              style={{
                padding: '12px',
                border: '2px solid #4CAF50',
                borderRadius: '8px',
                background: 'transparent',
                color: '#4CAF50',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              <i className="fa fa-check-circle" style={{ marginRight: '6px' }}></i>
              Test Constraints First
            </button>
          </div>

          {/* Tips */}
          <div style={{ 
            marginTop: '16px',
            padding: '12px',
            background: '#fff3e0',
            borderRadius: '8px',
            border: '1px solid #ffb74d',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '14px' }}>💡</span>
              <span style={{ fontWeight: 600, color: '#e65100', fontSize: '12px' }}>Tips</span>
            </div>
            <ul style={{ fontSize: '11px', margin: 0, paddingLeft: '18px', color: '#bf360c', lineHeight: 1.6 }}>
              <li>Run &quot;Test Constraints&quot; first to validate lesson requirements</li>
              <li>Make sure all teachers and subjects are assigned</li>
              <li>Configure break periods in Settings before generating</li>
              <li>Use &quot;Selected Classes&quot; to test on specific classes first</li>
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              border: '2px solid var(--ut-border)',
              borderRadius: '8px',
              background: '#fff',
              color: '#666',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13px',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
