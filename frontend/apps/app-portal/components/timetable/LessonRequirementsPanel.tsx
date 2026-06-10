'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { classApi, teacherApi, subjectApi, timetableApi } from '@/lib/api';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import type { Slot } from '@/types/timetable';

interface LessonRequirement {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  lessonsPerWeek: number;
  lessonsAssigned: number;
  remainingLessons: number;
}

interface LessonRequirementCardProps {
  requirement: LessonRequirement;
  onRemove?: (id: string) => void;
  teachers: any[];
  subjects: any[];
}

function LessonRequirementCard({ requirement, onRemove, teachers, subjects }: LessonRequirementCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `requirement-${requirement.id}`,
    data: requirement,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.8 : 1,
  } : undefined;

  const progressPercent = requirement.lessonsPerWeek > 0 
    ? (requirement.lessonsAssigned / requirement.lessonsPerWeek) * 100 
    : 0;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...style,
        padding: '12px',
        background: isHovered ? '#ffefeb' : '#fff',
        border: `2px solid ${requirement.remainingLessons === 0 ? '#4CAF50' : '#e0e0e0'}`,
        borderRadius: '8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'all 0.2s',
        marginBottom: '8px',
        position: 'relative',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      {/* Status Indicator */}
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        height: '3px',
        borderRadius: '8px 8px 0 0',
        background: requirement.remainingLessons === 0 
          ? '#4CAF50' 
          : requirement.remainingLessons < requirement.lessonsPerWeek / 2 
            ? '#ff9800' 
            : '#667eea',
      }} />
      
      {/* Subject Badge */}
      <div style={{
        display: 'inline-block',
        padding: '4px 10px',
        background: '#667eea',
        color: '#fff',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 600,
        marginBottom: '6px',
        marginTop: '4px',
      }}>
        {requirement.subjectName}
      </div>
      
      {/* Class & Teacher */}
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
        <strong style={{ color: '#333' }}>{requirement.className}</strong>
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
        <i className="fa fa-user-tie" style={{ marginRight: '4px' }}></i>
        {requirement.teacherName || 'Unassigned'}
      </div>
      
      {/* Progress Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '8px',
        fontSize: '11px',
        color: '#888',
      }}>
        <div style={{
          flex: 1,
          height: '6px',
          background: '#e0e0e0',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: requirement.remainingLessons === 0 ? '#4CAF50' : '#667eea',
            transition: 'width 0.3s',
          }} />
        </div>
        <span style={{ fontWeight: 600, minWidth: '40px' }}>
          {requirement.lessonsAssigned}/{requirement.lessonsPerWeek}
        </span>
      </div>
      
      {/* Hover Details Overlay */}
      {isHovered && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px',
          padding: '12px',
          background: '#333',
          color: '#fff',
          borderRadius: '8px',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          minWidth: '200px',
        }}>
          <div style={{ marginBottom: '6px', borderBottom: '1px solid #555', paddingBottom: '6px' }}>
            <strong style={{ color: '#667eea' }}>{requirement.subjectName}</strong>
          </div>
          <div style={{ marginBottom: '4px' }}>
            <i className="fa fa-school" style={{ marginRight: '6px' }}></i>
            <strong>Class:</strong> {requirement.className}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <i className="fa fa-user-tie" style={{ marginRight: '6px' }}></i>
            <strong>Teacher:</strong> {requirement.teacherName || 'Unassigned'}
          </div>
          <div>
            <i className="fa fa-calendar-check" style={{ marginRight: '6px' }}></i>
            <strong>Progress:</strong> {requirement.lessonsAssigned} of {requirement.lessonsPerWeek} slots
            {requirement.remainingLessons > 0 && (
              <span style={{ color: '#ff9800' }}> ({requirement.remainingLessons} remaining)</span>
            )}
            {requirement.remainingLessons === 0 && (
              <span style={{ color: '#4CAF50' }}> ✓ Complete</span>
            )}
          </div>
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            border: '8px solid transparent',
            borderTopColor: '#333',
          }} />
        </div>
      )}
      
      {/* Remove Button */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Remove this lesson requirement?')) {
              onRemove(requirement.id);
            }
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            width: '20px',
            height: '20px',
            border: 'none',
            background: '#ff4444',
            color: '#fff',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

interface LessonRequirementsPanelProps {
  termId: string;
  onDragEnd?: (requirement: LessonRequirement, day: number, period: number) => void;
  classTimetable?: any;
}

export default function LessonRequirementsPanel({ termId, onDragEnd, classTimetable }: LessonRequirementsPanelProps) {
  const queryClient = useQueryClient();
  const [requirements, setRequirements] = useState<LessonRequirement[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'complete'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const { data: allLessonRequirements } = useQuery({
    queryKey: ['all-lesson-requirements'],
    queryFn: async () => {
      try {
        const res = await timetableApi.getAllLessonRequirements();
        return res.data?.data || res.data || [];
      } catch (error) {
        console.warn('Failed to fetch all lesson requirements:', error);
        return [];
      }
    },
  });

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

  const isLoading = false;

  // Transform backend data to our format
  useEffect(() => {
    if (allLessonRequirements && Array.isArray(allLessonRequirements) && allLessonRequirements.length > 0) {
      const transformed = allLessonRequirements.map((req: any, index: number) => {
        const cls = classes.find((c: any) => c.id === req.classId) || req.class;
        const subj = subjects.find((s: any) => s.id === req.subjectId) || req.subject;
        const teacher = teachers.find((t: any) => t.id === req.teacherId) || req.teacher;
        
        return {
          id: req.id || `req-${index}`,
          classId: req.classId || '',
          className: cls?.name || 'Unknown Class',
          subjectId: req.subjectId || '',
          subjectName: subj?.name || 'Unknown Subject',
          teacherId: req.teacherId || '',
          teacherName: teacher?.user 
            ? `${teacher.user.firstName} ${teacher.user.lastName}` 
            : 'Unassigned',
          lessonsPerWeek: req.lessonsPerWeek || 1,
          lessonsAssigned: req.lessonsAssigned || 0,
          remainingLessons: (req.lessonsPerWeek || 1) - (req.lessonsAssigned || 0),
        };
      });
      setRequirements(transformed);
    }
  }, [allLessonRequirements, classes, teachers, subjects]);

  // No sample data generation — wait for real backend data

  const handleRemove = async (id: string) => {
    try {
      await timetableApi.deleteLessonRequirement(id);
      setRequirements(prev => prev.filter(r => r.id !== id));
      queryClient.invalidateQueries({ queryKey: ['all-lesson-requirements'] });
    } catch (error) {
      console.warn('Failed to delete lesson requirement:', error);
      setRequirements(prev => prev.filter(r => r.id !== id));
    }
  };

  const filteredRequirements = requirements.filter(req => {
    if (filter === 'pending' && req.remainingLessons === 0) return false;
    if (filter === 'complete' && req.remainingLessons > 0) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        req.className.toLowerCase().includes(query) ||
        req.subjectName.toLowerCase().includes(query) ||
        req.teacherName.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const stats = {
    total: requirements.length,
    pending: requirements.filter(r => r.remainingLessons > 0).length,
    complete: requirements.filter(r => r.remainingLessons === 0).length,
  };

  return (
    <div style={{
      width: '300px',
      background: '#fff',
      borderRight: '1px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
      }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          <i className="fa fa-list-ul" style={{ marginRight: '8px' }}></i>
          Lesson Requirements
        </h3>
        <p style={{ margin: 0, fontSize: '11px', opacity: 0.9 }}>
          Drag cards to timetable slots
        </p>
      </div>
      
      {/* Class Selector */}
      <div style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
        <label style={{ fontSize: '11px', color: '#666', marginBottom: '4px', display: 'block' }}>
          Filter by Class:
        </label>
        <select
          value={selectedClassId}
          onChange={e => setSelectedClassId(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '12px',
            background: '#fff',
          }}
        >
          <option value="">All Classes</option>
          {classes.map((cls: any) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
      </div>
      
      {/* Stats */}
      <div style={{
        display: 'flex',
        padding: '12px',
        borderBottom: '1px solid #e0e0e0',
        background: '#f9f9f9',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#333' }}>{stats.total}</div>
          <div style={{ fontSize: '10px', color: '#888' }}>Total</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ff9800' }}>{stats.pending}</div>
          <div style={{ fontSize: '10px', color: '#888' }}>Pending</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', borderLeft: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#4CAF50' }}>{stats.complete}</div>
          <div style={{ fontSize: '10px', color: '#888' }}>Done</div>
        </div>
      </div>
      
      {/* Search & Filter */}
      <div style={{ padding: '12px', borderBottom: '1px solid #e0e0e0' }}>
        <input
          type="text"
          placeholder="Search class, subject, teacher..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '8px',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'pending', 'complete'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                flex: 1,
                padding: '6px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                background: filter === f ? '#667eea' : '#f0f0f0',
                color: filter === f ? '#fff' : '#666',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      {/* Requirements List */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px',
      }}>
        {isLoading ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#888',
            fontSize: '12px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            Loading...
          </div>
        ) : filteredRequirements.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '20px',
            color: '#888',
            fontSize: '12px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>📋</div>
            {searchQuery || filter !== 'all' 
              ? 'No matching requirements' 
              : 'No lesson requirements yet'}
            <div style={{ marginTop: '12px' }}>
              <small style={{ color: '#aaa' }}>
                Add lessons using the Edit Timetable button
              </small>
            </div>
          </div>
        ) : (
          filteredRequirements.map(req => (
            <LessonRequirementCard
              key={req.id}
              requirement={req}
              onRemove={handleRemove}
              teachers={teachers}
              subjects={subjects}
            />
          ))
        )}
      </div>
      
      {/* Footer Actions */}
      <div style={{
        padding: '12px',
        borderTop: '1px solid #e0e0e0',
        background: '#f9f9f9',
      }}>
        <button
          style={{
            width: '100%',
            padding: '10px',
            border: 'none',
            borderRadius: '6px',
            background: '#667eea',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '8px',
          }}
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['all-lesson-requirements'] });
            queryClient.invalidateQueries({ queryKey: ['classes'] });
            queryClient.invalidateQueries({ queryKey: ['teachers'] });
            queryClient.invalidateQueries({ queryKey: ['subjects'] });
          }}
        >
          <i className="fa fa-refresh" style={{ marginRight: '6px' }}></i>
          Refresh
        </button>
        <div style={{ fontSize: '10px', color: '#888', textAlign: 'center' }}>
          {requirements.length} requirement{requirements.length !== 1 ? 's' : ''} loaded
        </div>
      </div>
    </div>
  );
}
