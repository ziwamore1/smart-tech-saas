'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { lessonPlansApi, classApi as classesApi, subjectApi as subjectsApi } from '@/lib/api';

interface LessonPlan {
  id: string;
  title: string;
  description?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  weekStart: string;
  weekEnd: string;
  objectives?: string[];
  materials?: string;
  procedures?: string;
  assessment?: string;
  notes?: string;
  content?: any[];
  config?: any;
  tags?: string[];
  status: 'draft' | 'pending' | 'approved' | 'completed';
  createdAt: string;
  updatedAt: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

interface Class {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
}

export default function LessonPlansPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const [newPlan, setNewPlan] = useState({
    title: '',
    description: '',
    classId: '',
    subjectId: '',
    weekStart: '',
    weekEnd: '',
    objectives: [] as string[],
    materials: '',
    procedures: '',
    assessment: '',
    notes: '',
    tags: [] as string[],
    status: 'draft',
  });
  const [newTagInput, setNewTagInput] = useState('');
  const [newObjective, setNewObjective] = useState('');

  const [filters, setFilters] = useState({
    classId: '',
    subjectId: '',
    status: '',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, selectedClass, selectedSubject]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansRes, classesRes, subjectsRes] = await Promise.all([
        lessonPlansApi.getAll(selectedClass !== 'all' ? { classId: selectedClass, subjectId: selectedSubject !== 'all' ? selectedSubject : undefined } : {}),
        classesApi.getAll(),
        subjectsApi.getAll(),
      ]);
      setPlans(plansRes.data?.data || plansRes.data || []);
      setClasses(classesRes.data?.data || classesRes.data || []);
      setSubjects(subjectsRes.data?.data || subjectsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newPlan.title.trim() || !newPlan.classId || !newPlan.subjectId) return;
    
    try {
      const response = await lessonPlansApi.create({ ...newPlan, tags: newPlan.tags });
      setPlans([...plans, response.data]);
      setShowAddModal(false);
      setNewPlan({
        title: '',
        description: '',
        classId: '',
        subjectId: '',
        weekStart: '',
        weekEnd: '',
        objectives: [],
        materials: '',
        procedures: '',
        assessment: '',
        notes: '',
        tags: [],
        status: 'draft',
      });
    } catch (error) {
      console.error('Failed to create lesson plan:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson plan?')) return;
    
    try {
      await lessonPlansApi.delete(id);
      setPlans(plans.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete lesson plan:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await lessonPlansApi.update(id, { status });
      setPlans(plans.map(p => p.id === id ? { ...p, status: status as LessonPlan['status'] } : p));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const getPreviewText = (plan: LessonPlan): string => {
    if (plan.content && Array.isArray(plan.content) && plan.content.length > 0) {
      const firstContent = plan.content.find((s: any) => s.content && stripHtml(s.content).length > 0);
      if (firstContent) {
        const text = stripHtml(firstContent.content);
        return text.length > 120 ? text.slice(0, 120) + '...' : text;
      }
    }
    if (plan.description) {
      return plan.description.length > 120 ? plan.description.slice(0, 120) + '...' : plan.description;
    }
    return '';
  };

  const addTag = () => {
    const tag = newTagInput.trim();
    if (tag && !newPlan.tags.includes(tag)) {
      setNewPlan({ ...newPlan, tags: [...newPlan.tags, tag] });
    }
    setNewTagInput('');
  };

  const removeTag = (index: number) => {
    setNewPlan({ ...newPlan, tags: newPlan.tags.filter((_, i) => i !== index) });
  };

  const addObjective = () => {
    if (!newObjective.trim()) return;
    setNewPlan({ ...newPlan, objectives: [...newPlan.objectives, newObjective.trim()] });
    setNewObjective('');
  };

  const removeObjective = (index: number) => {
    setNewPlan({ ...newPlan, objectives: newPlan.objectives.filter((_, i) => i !== index) });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return { bg: '#f3f4f6', color: '#6b7280' };
      case 'pending': return { bg: '#fef3c7', color: '#d97706' };
      case 'approved': return { bg: '#d1fae5', color: '#059669' };
      case 'completed': return { bg: '#dbeafe', color: '#2563eb' };
      default: return { bg: '#f3f4f6', color: '#6b7280' };
    }
  };

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || plan.classId === selectedClass;
    const matchesSubject = selectedSubject === 'all' || plan.subjectId === selectedSubject;
    return matchesSearch && matchesClass && matchesSubject;
  });

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .plan-card { transition: all 0.3s ease; }
        .plan-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .objective-tag { transition: all 0.2s; }
        .objective-tag:hover { background: #fee2e2; }
        input, select, textarea { border: 1px solid #e8ddd0; border-radius: 8px; padding: 12px; width: 100%; font-size: 14px; transition: all 0.2s; box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-clipboard-list" style={{ color: 'white', fontSize: '18px' }}></i>
            </div>
            Lesson Plans
          </h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Create and manage lesson plans for your classes</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
        >
          <i className="fa fa-plus"></i> Create Lesson Plan
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
          <div style={{ position: 'relative' }}>
            <i className="fa fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
            <input
              type="text"
              placeholder="Search lesson plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          <option value="all">All Classes</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          <option value="all">All Subjects</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {filteredPlans.map(plan => {
          const statusStyle = getStatusColor(plan.status);
          const isExpanded = expandedPlan === plan.id;
          return (
            <div
              key={plan.id}
              className="plan-card"
              style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: isExpanded ? '20px' : '20px 20px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '48px', height: '48px', background: '#f59e0b15', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fa fa-clipboard-list" style={{ color: '#f59e0b', fontSize: '20px' }}></i>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: statusStyle.bg, color: statusStyle.color, textTransform: 'capitalize' }}>
                  {plan.status}
                </span>
              </div>
              
              <h3 style={{ fontWeight: '700', color: '#111827', marginBottom: '8px', fontSize: '16px' }}>{plan.title}</h3>
              {getPreviewText(plan) && (
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', lineHeight: 1.4 }}>{getPreviewText(plan)}</p>
              )}
              {plan.tags && plan.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' }}>
                  {plan.tags.map((tag, i) => (
                    <span key={i} style={{ padding: '2px 8px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '12px', fontSize: '11px', fontWeight: 500 }}>{tag}</span>
                  ))}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#9ca3af', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span><i className="fa fa-clock-o mr-1"></i> {new Date(plan.weekStart).toLocaleDateString()} - {new Date(plan.weekEnd).toLocaleDateString()}</span>
                {plan.className && <span><i className="fa fa-users mr-1"></i> {plan.className}</span>}
                {plan.subjectName && <span><i className="fa fa-book mr-1"></i> {plan.subjectName}</span>}
              </div>

              {isExpanded && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e8ddd0' }}>
                  {plan.objectives && plan.objectives.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Learning Objectives</h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#6b7280' }}>
                        {plan.objectives.map((obj, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {plan.materials && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Materials Needed</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{plan.materials}</p>
                    </div>
                  )}
                  {plan.procedures && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Procedures</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{plan.procedures}</p>
                    </div>
                  )}
                  {plan.assessment && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Assessment</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{plan.assessment}</p>
                    </div>
                  )}
                  {plan.notes && (
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Notes</h4>
                      <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{plan.notes}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => router.push(`/dashboard/lesson-plans/${plan.id}/edit`)}
                  style={{ padding: '10px 12px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: '1px solid #C7D2FE' }}
                  title="Open rich editor"
                >
                  <i className="fa fa-pencil-square-o mr-2"></i> Edit
                </button>
                <button
                  onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                  style={{ flex: '1', padding: '10px 12px', background: '#f59e0b10', color: '#d97706', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: '1px solid #fde68a' }}
                >
                  <i className={`fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} mr-2`}></i>
                  {isExpanded ? 'Less' : 'More'}
                </button>
                <select
                  value={plan.status}
                  onChange={(e) => handleUpdateStatus(plan.id, e.target.value)}
                  style={{ padding: '10px', fontSize: '13px', fontWeight: '600', minWidth: '100px' }}
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="completed">Completed</option>
                </select>
                <button
                  onClick={() => handleDelete(plan.id)}
                  style={{ padding: '10px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                >
                  <i className="fa fa-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredPlans.length === 0 && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '48px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 16px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-clipboard-list" style={{ color: '#9ca3af', fontSize: '32px' }}></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>No Lesson Plans Found</h3>
          <p style={{ color: '#6b7280', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            {searchQuery || selectedClass !== 'all' || selectedSubject !== 'all'
              ? 'No lesson plans match your filters. Try adjusting your search.'
              : 'Start by creating lesson plans for your classes.'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
          >
            <i className="fa fa-plus"></i> Create First Lesson Plan
          </button>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>Create Lesson Plan</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
                <i className="fa fa-times" style={{ fontSize: '20px' }}></i>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Title *</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  placeholder="e.g., Introduction to Algebra"
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Class *</label>
                  <select
                    value={newPlan.classId}
                    onChange={(e) => setNewPlan({ ...newPlan, classId: e.target.value })}
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Subject *</label>
                  <select
                    value={newPlan.subjectId}
                    onChange={(e) => setNewPlan({ ...newPlan, subjectId: e.target.value })}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Week Start</label>
                  <input
                    type="date"
                    value={newPlan.weekStart}
                    onChange={(e) => setNewPlan({ ...newPlan, weekStart: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Week End</label>
                  <input
                    type="date"
                    value={newPlan.weekEnd}
                    onChange={(e) => setNewPlan({ ...newPlan, weekEnd: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  rows={2}
                  placeholder="Brief description..."
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Learning Objectives</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newObjective}
                    onChange={(e) => setNewObjective(e.target.value)}
                    placeholder="Add an objective..."
                    onKeyPress={(e) => e.key === 'Enter' && addObjective()}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={addObjective}
                    style={{ padding: '12px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    <i className="fa fa-plus"></i>
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {newPlan.objectives.map((obj, i) => (
                    <span
                      key={i}
                      className="objective-tag"
                      style={{ padding: '4px 12px', background: '#fef3c7', color: '#92400e', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {obj}
                      <button onClick={() => removeObjective(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', padding: 0 }}>
                        <i className="fa fa-times"></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Materials Needed</label>
                <textarea
                  value={newPlan.materials}
                  onChange={(e) => setNewPlan({ ...newPlan, materials: e.target.value })}
                  rows={2}
                  placeholder="List required materials..."
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Procedures</label>
                <textarea
                  value={newPlan.procedures}
                  onChange={(e) => setNewPlan({ ...newPlan, procedures: e.target.value })}
                  rows={3}
                  placeholder="Step-by-step procedures..."
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Assessment</label>
                <textarea
                  value={newPlan.assessment}
                  onChange={(e) => setNewPlan({ ...newPlan, assessment: e.target.value })}
                  rows={2}
                  placeholder="How will learning be assessed..."
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Notes</label>
                <textarea
                  value={newPlan.notes}
                  onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Tags</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    style={{ flex: 1 }}
                  />
                  <button onClick={addTag} style={{ padding: '12px 16px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                    <i className="fa fa-plus"></i>
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {newPlan.tags.map((tag, i) => (
                    <span key={i} style={{ padding: '4px 12px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {tag}
                      <button onClick={() => removeTag(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4F46E5', padding: 0 }}>
                        <i className="fa fa-times"></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ flex: '1', padding: '12px', border: '1px solid #e8ddd0', color: '#374151', background: '#fefcf9', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newPlan.title.trim() || !newPlan.classId || !newPlan.subjectId}
                style={{ flex: '1', padding: '12px', background: newPlan.title.trim() && newPlan.classId && newPlan.subjectId ? 'linear-gradient(135deg, #f59e0b, #d97706)' : '#9ca3af', color: 'white', border: 'none', borderRadius: '10px', cursor: newPlan.title.trim() && newPlan.classId && newPlan.subjectId ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }}
              >
                Create Lesson Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}