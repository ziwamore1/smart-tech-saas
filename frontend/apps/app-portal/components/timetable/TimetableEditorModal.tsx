'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, teacherApi, subjectApi, timetableApi } from '@/lib/api';
import type { Slot } from '@/types/timetable';

interface SlotEditor {
  id?: string;
  classId: string;
  subjectId: string;
  teacherIds: string[];
  day: number;
  period: number;
  weekType: 'regular' | 'A' | 'B';
  lessonsCount: number;
  lessonSize: 1 | 2 | 3;
  isNew: boolean;
}

interface TimetableEditorProps {
  isOpen: boolean;
  onClose: () => void;
  termId: string;
  initialSlot?: Slot | null;
  mode: 'add' | 'edit';
  schoolId?: string;
  prefill?: {
    classId?: string;
    subjectId?: string;
    teacherId?: string;
    day?: number;
    period?: number;
  } | null;
}

export default function TimetableEditorModal({
  isOpen,
  onClose,
  termId,
  initialSlot,
  mode,
  schoolId = '',
  prefill = null
}: TimetableEditorProps) {
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [slot, setSlot] = useState<SlotEditor>({
    classId: '',
    subjectId: '',
    teacherIds: [],
    day: 1,
    period: 1,
    weekType: 'regular',
    lessonsCount: 1,
    lessonSize: 1,
    isNew: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{valid: boolean; errors: string[]} | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    if (initialSlot && mode === 'edit') {
      setSlot({
        id: initialSlot.id,
        classId: initialSlot.classGroup?.id || '',
        subjectId: initialSlot.subject?.id || '',
        teacherIds: [initialSlot.teacher?.id || ''],
        day: initialSlot.day || 1,
        period: initialSlot.period || 1,
        weekType: initialSlot.weekType || 'regular',
        lessonsCount: 1,
        lessonSize: 1,
        isNew: false,
      });
    } else if (mode === 'add' && prefill) {
      setSlot({
        id: undefined,
        classId: prefill.classId || '',
        subjectId: prefill.subjectId || '',
        teacherIds: prefill.teacherId ? [prefill.teacherId] : [''],
        day: prefill.day || 1,
        period: prefill.period || 1,
        weekType: 'regular',
        lessonsCount: 1,
        lessonSize: 1,
        isNew: true,
      });
    } else {
      setSlot({
        classId: '',
        subjectId: '',
        teacherIds: [''],
        day: 1,
        period: 1,
        weekType: 'regular',
        lessonsCount: 1,
        lessonSize: 1,
        isNew: true,
      });
    }
    setCurrentStep(1);
    setTestResult(null);
  }, [initialSlot, mode, prefill]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const res = await teacherApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const handleAddTeacher = () => {
    setSlot(prev => ({
      ...prev,
      teacherIds: [...prev.teacherIds, ''],
    }));
  };

  const handleRemoveTeacher = (index: number) => {
    if (slot.teacherIds.length > 1) {
      setSlot(prev => ({
        ...prev,
        teacherIds: prev.teacherIds.filter((_, i) => i !== index),
      }));
    }
  };

  const handleTeacherChange = (index: number, teacherId: string) => {
    setSlot(prev => ({
      ...prev,
      teacherIds: prev.teacherIds.map((id, i) => i === index ? teacherId : id),
    }));
  };

  const handleTestConstraints = async () => {
    setIsGenerating(true);
    setTestResult(null);
    
    try {
      const errors: string[] = [];
      
      if (!slot.classId) errors.push('Please select a class');
      if (!slot.subjectId) errors.push('Please select a subject');
      if (!slot.teacherIds[0]) errors.push('Please select at least one teacher');
      
      if (slot.teacherIds.length > 1) {
        const uniqueTeachers = new Set(slot.teacherIds);
        if (uniqueTeachers.size !== slot.teacherIds.length) {
          errors.push('Duplicate teachers selected');
        }
      }

      const selectedTeachers = teachers.filter((t: any) => slot.teacherIds.includes(t.id));
      const teacherConflicts = await checkTeacherConflicts();
      if (teacherConflicts.length > 0) {
        errors.push(...teacherConflicts);
      }

      setTestResult({
        valid: errors.length === 0,
        errors,
      });
    } catch (error) {
      setTestResult({
        valid: false,
        errors: ['Failed to test constraints: ' + (error as Error).message],
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const checkTeacherConflicts = async (): Promise<string[]> => {
    const errors: string[] = [];
    
    for (const teacherId of slot.teacherIds) {
      if (!teacherId || !termId) continue;
      
      try {
        const res = await timetableApi.getTeacherTimetable(teacherId, termId);
        const timetable = res.data?.data || res.data;
        const slots = timetable?.slots || [];
        
        const conflict = slots.find((s: Slot) => 
          s.day === slot.day && 
          s.period === slot.period &&
          s.id !== slot.id
        );
        
        if (conflict) {
          const teacher = teachers.find((t: any) => t.id === teacherId);
          const teacherName = teacher ? `${teacher.user.firstName} ${teacher.user.lastName}` : teacherId;
          errors.push(`Teacher ${teacherName} already has a class at this time`);
        }
      } catch (error) {
        // Silently ignore - endpoint may not exist
      }
    }
    
    return errors;
  };

  const handleGenerate = async () => {
    if (!schoolId) {
      alert('School ID not available');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    
    try {
      const interval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const res = await timetableApi.generateAllClasses(termId);
      const { jobId } = res.data?.data || res.data || {};

      clearInterval(interval);
      setGenerationProgress(100);

      if (jobId) {
        await pollJobStatus(jobId);
      }

      queryClient.invalidateQueries({ queryKey: ['class-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['masterTimetable'] });
      
      alert('Timetable generated successfully!');
    } catch (error) {
      alert('Failed to generate timetable: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    return new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 120;

      const check = async () => {
        try {
          attempts++;
          const res = await timetableApi.getJobStatus(jobId);
          const status = res.data?.data || res.data;

          if (!status || (typeof status === 'object' && Object.keys(status).length === 0)) {
            if (attempts >= maxAttempts) {
              reject(new Error('Failed to get job status'));
            } else {
              setTimeout(check, 1000);
            }
            return;
          }

          setGenerationProgress(status?.progress || 50);

          if (status?.status === 'completed') {
            resolve();
          } else if (status?.status === 'failed') {
            reject(new Error(status?.error || 'Generation failed'));
          } else if (attempts >= maxAttempts) {
            reject(new Error('Generation timed out'));
          } else {
            setTimeout(check, 1000);
          }
        } catch (error: any) {
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

  const handleSave = async () => {
    setIsSaving(true);
    
    try {
      const totalPeriodsPerWeek = slot.lessonsCount * slot.lessonSize;

      if (mode === 'edit' && slot.id) {
        await timetableApi.moveSlot(slot.id, slot.day, slot.period);
      } else {
        await timetableApi.createLessonRequirement({
          classId: slot.classId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherIds[0],
          lessonsPerWeek: totalPeriodsPerWeek,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['class-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['masterTimetable'] });
      queryClient.invalidateQueries({ queryKey: ['all-lesson-requirements'] });
      queryClient.invalidateQueries({ queryKey: ['lesson-requirements'] });
      
      showNotification('Lesson requirement saved successfully!');
      onClose();
    } catch (error: any) {
      console.error('Failed to save:', error);
      // Show more helpful error message
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      showNotification(`Failed to save: ${errorMessage}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slot.id) return;
    
    if (!confirm('Are you sure you want to delete this slot?')) return;
    
    try {
      await timetableApi.deleteTimetable(slot.id);
      queryClient.invalidateQueries({ queryKey: ['class-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['masterTimetable'] });
      onClose();
    } catch (error) {
      alert('Failed to delete: ' + (error as Error).message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ut-modal-overlay" onClick={onClose}>
      <div className="ut-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="ut-modal-header">
          <h3 className="ut-modal-title">
            {mode === 'edit' ? 'Edit Timetable Slot' : 'Add New Lesson'}
          </h3>
          <button className="ut-modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Progress Steps */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[1, 2, 3].map(step => (
            <div
              key={step}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                background: currentStep >= step ? 'var(--ut-primary)' : 'var(--ut-border)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Step 1: Class & Subject */}
        {currentStep === 1 && (
          <div className="ut-modal-section">
            <h4 style={{ marginBottom: '16px', fontWeight: 600 }}>Step 1: Select Class & Subject</h4>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="ut-modal-label">Class *</label>
              <select
                className="ut-select"
                style={{ width: '100%' }}
                value={slot.classId}
                onChange={e => setSlot(prev => ({ ...prev, classId: e.target.value }))}
              >
                <option value="">-- Select Class --</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="ut-modal-label">Subject *</label>
              <select
                className="ut-select"
                style={{ width: '100%' }}
                value={slot.subjectId}
                onChange={e => setSlot(prev => ({ ...prev, subjectId: e.target.value }))}
              >
                <option value="">-- Select Subject --</option>
                {subjects.map((subj: any) => (
                  <option key={subj.id} value={subj.id}>{subj.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="ut-modal-label">Lessons per Week</label>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', color: 'var(--ut-text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Count (how many groups)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4].map(num => (
                      <button
                        key={num}
                        onClick={() => setSlot(prev => ({ ...prev, lessonsCount: num }))}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: `2px solid ${slot.lessonsCount === num ? 'var(--ut-primary)' : 'var(--ut-border)'}`,
                          borderRadius: '8px',
                          background: slot.lessonsCount === num ? 'var(--ut-primary)' : 'transparent',
                          color: slot.lessonsCount === num ? '#fff' : 'var(--ut-text)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '14px',
                        }}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div style={{ flex: 2 }}>
                  <label style={{ fontSize: '12px', color: 'var(--ut-text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Size (periods per group)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[{ v: 1, l: 'Single' }, { v: 2, l: 'Double' }, { v: 3, l: 'Triple' }].map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => setSlot(prev => ({ ...prev, lessonSize: v as 1 | 2 | 3 }))}
                        style={{
                          flex: 1,
                          padding: '10px',
                          border: `2px solid ${slot.lessonSize === v ? 'var(--ut-primary)' : 'var(--ut-border)'}`,
                          borderRadius: '8px',
                          background: slot.lessonSize === v ? 'var(--ut-primary)' : 'transparent',
                          color: slot.lessonSize === v ? '#fff' : 'var(--ut-text)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '13px',
                        }}
                      >
                        {l} ({v})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={{ 
                padding: '10px 14px', 
                background: 'var(--ut-primary)', 
                color: '#fff',
                borderRadius: '8px',
                fontSize: '13px',
                textAlign: 'center',
                fontWeight: 500,
              }}>
                Total: {slot.lessonsCount * slot.lessonSize} period{slot.lessonsCount * slot.lessonSize !== 1 ? 's' : ''} per week
              </div>
              
              <p style={{ fontSize: '11px', color: 'var(--ut-text-secondary)', marginTop: '8px' }}>
                Example: 3 double periods = 6 periods/week split across 3 different time slots
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Teacher Assignment */}
        {currentStep === 2 && (
          <div className="ut-modal-section">
            <h4 style={{ marginBottom: '16px', fontWeight: 600 }}>Step 2: Assign Teacher(s)</h4>
            
            <div style={{ marginBottom: '16px' }}>
              <label className="ut-modal-label">Week Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['regular', 'A', 'B'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setSlot(prev => ({ ...prev, weekType: type }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: `2px solid ${slot.weekType === type ? 'var(--ut-primary)' : 'var(--ut-border)'}`,
                      borderRadius: '8px',
                      background: slot.weekType === type ? 'var(--ut-primary)' : 'transparent',
                      color: slot.weekType === type ? '#fff' : 'var(--ut-text)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {type === 'regular' ? 'Every Week' : `Week ${type}`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="ut-modal-label">Teacher(s)</label>
              {slot.teacherIds.map((teacherId, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <select
                    className="ut-select"
                    style={{ flex: 1 }}
                    value={teacherId}
                    onChange={e => handleTeacherChange(index, e.target.value)}
                  >
                    <option value="">-- Select Teacher --</option>
                    {teachers.map((teacher: any) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.user?.firstName} {teacher.user?.lastName}
                      </option>
                    ))}
                  </select>
                  {slot.teacherIds.length > 1 && (
                    <button
                      onClick={() => handleRemoveTeacher(index)}
                      style={{
                        padding: '8px 12px',
                        background: '#ff4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={handleAddTeacher}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '2px dashed var(--ut-border)',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'var(--ut-primary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                + Add More Teachers (Split Class)
              </button>
              <p style={{ fontSize: '12px', color: 'var(--ut-text-secondary)', marginTop: '8px' }}>
                Add multiple teachers to split the class into groups at the same time
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label className="ut-modal-label">Day & Period</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="ut-select"
                  style={{ flex: 1 }}
                  value={slot.day}
                  onChange={e => setSlot(prev => ({ ...prev, day: parseInt(e.target.value) }))}
                >
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
                    <option key={i + 1} value={i + 1}>{day}</option>
                  ))}
                </select>
                <select
                  className="ut-select"
                  style={{ flex: 1 }}
                  value={slot.period}
                  onChange={e => setSlot(prev => ({ ...prev, period: parseInt(e.target.value) }))}
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Period {i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Actions */}
        {currentStep === 3 && (
          <div className="ut-modal-section">
            <h4 style={{ marginBottom: '16px', fontWeight: 600 }}>Step 3: Review & Actions</h4>
            
            <div style={{
              background: 'var(--ut-bg)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '16px',
            }}>
              <h5 style={{ marginBottom: '12px', fontWeight: 600 }}>Summary</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '14px' }}>
                <div><strong>Class:</strong> {classes.find((c: any) => c.id === slot.classId)?.name || '-'}</div>
                <div><strong>Subject:</strong> {subjects.find((s: any) => s.id === slot.subjectId)?.name || '-'}</div>
                <div><strong>Teachers:</strong> {slot.teacherIds.length}</div>
                <div><strong>Groups:</strong> {slot.lessonsCount}</div>
                <div><strong>Group Size:</strong> {slot.lessonSize === 1 ? 'Single' : slot.lessonSize === 2 ? 'Double' : 'Triple'} ({slot.lessonSize})</div>
                <div><strong>Total Periods:</strong> {slot.lessonsCount * slot.lessonSize}/week</div>
                <div><strong>Day:</strong> {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.day - 1]}</div>
                <div><strong>Period:</strong> {slot.period}</div>
                <div><strong>Week Type:</strong> {slot.weekType === 'regular' ? 'Every Week' : `Week ${slot.weekType}`}</div>
              </div>
            </div>

            {testResult && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                background: testResult.valid ? '#e8f5e9' : '#ffebee',
                border: `1px solid ${testResult.valid ? '#4CAF50' : '#f44336'}`,
              }}>
                <h5 style={{ 
                  color: testResult.valid ? '#4CAF50' : '#f44336',
                  marginBottom: '8px',
                  fontWeight: 600,
                }}>
                  {testResult.valid ? '✓ All Constraints Valid!' : '✗ Constraint Errors Found'}
                </h5>
                {testResult.errors.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#c62828' }}>
                    {testResult.errors.map((error, i) => <li key={i}>{error}</li>)}
                  </ul>
                )}
              </div>
            )}

            {isGenerating && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  height: '8px',
                  background: 'var(--ut-border)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${generationProgress}%`,
                    background: 'var(--ut-primary)',
                    transition: 'width 0.3s',
                  }} />
                </div>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>
                  {generationProgress < 100 ? 'Generating timetable...' : 'Complete!'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              className="ut-action-btn"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              Previous
            </button>
          )}
          
          {currentStep < 3 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              className="ut-action-btn primary"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={currentStep === 1 && (!slot.classId || !slot.subjectId)}
            >
              Next
            </button>
          ) : (
            <>
              <button
                onClick={handleTestConstraints}
                className="ut-action-btn"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={isGenerating}
              >
                {isGenerating ? 'Testing...' : 'Test Constraints'}
              </button>
              <button
                onClick={handleSave}
                className="ut-action-btn primary"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={isSaving || isGenerating}
              >
                {isSaving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Add Lesson'}
              </button>
            </>
          )}
        </div>

        {mode === 'edit' && slot.id && (
          <button
            onClick={handleDelete}
            className="ut-action-btn"
            style={{
              width: '100%',
              marginTop: '12px',
              justifyContent: 'center',
              background: '#ff4444',
              color: '#fff',
              border: 'none',
            }}
          >
            Delete Slot
          </button>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          background: notification.type === 'error' ? '#ff4444' : '#4CAF50',
          color: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 10000,
          animation: 'slideUp 0.3s ease-out',
        }}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
