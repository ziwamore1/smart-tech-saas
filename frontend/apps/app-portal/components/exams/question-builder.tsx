'use client';
import { useState, useCallback } from 'react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY' | 'FILE_UPLOAD';
  question: string;
  score: number;
  options?: string[];
  correctAnswer?: string;
}

interface QuestionBuilderProps {
  questions: Question[];
  onChange: (questions: Question[]) => void;
  onAdd?: () => void;
}

function SortableQuestion({ question, index, onEdit, onDelete }: {
  question: Question; index: number;
  onEdit: (q: Question) => void; onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const typeColors: Record<string, string> = {
    MULTIPLE_CHOICE: '#3b82f6', TRUE_FALSE: '#10b981', SHORT_ANSWER: '#8b5cf6',
    ESSAY: '#f59e0b', FILE_UPLOAD: '#ef4444',
  };
  const typeIcons: Record<string, string> = {
    MULTIPLE_CHOICE: 'fa-list', TRUE_FALSE: 'fa-check-circle', SHORT_ANSWER: 'fa-pencil-alt',
    ESSAY: 'fa-file-text', FILE_UPLOAD: 'fa-upload',
  };

  return (
    <div ref={setNodeRef} style={{ ...style, background: '#fefcf9', border: '1px solid #e8ddd0', borderRadius: '12px', marginBottom: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button {...attributes} {...listeners} style={{ cursor: 'grab', border: 'none', background: 'none', padding: '4px', color: '#9ca3af', fontSize: '16px' }}>
        <i className="fa fa-grip-vertical" />
      </button>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: typeColors[question.type] || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
        <i className={`fa ${typeIcons[question.type] || 'fa-question'}`} style={{ fontSize: '16px' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{question.question.replace(/<[^>]*>/g, '').substring(0, 80)}</div>
        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>Question {index + 1} &middot; {question.score} pts &middot; {question.type.replace('_', ' ')}</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button onClick={() => onEdit(question)}
          style={{ padding: '6px 12px', border: '1px solid #e8ddd0', borderRadius: '8px', background: '#fefcf9', cursor: 'pointer', color: '#6b7280', fontSize: '12px' }}>
          <i className="fa fa-edit" /> Edit
        </button>
        <button onClick={() => onDelete(question.id)}
          style={{ padding: '6px 12px', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>
          <i className="fa fa-trash" />
        </button>
      </div>
    </div>
  );
}

export default function QuestionBuilder({ questions, onChange, onAdd }: QuestionBuilderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      onChange(arrayMove(questions, oldIndex, newIndex));
    }
  }, [questions, onChange]);

  const handleEdit = useCallback((question: Question) => {
    const newQuestions = questions.map(q => q.id === question.id ? question : q);
    onChange(newQuestions);
  }, [questions, onChange]);

  const handleDelete = useCallback((id: string) => {
    onChange(questions.filter(q => q.id !== id));
  }, [questions, onChange]);

  const questionType = (val: string) => val.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1f2937', margin: 0 }}>Questions ({questions.length})</h3>
          <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>Drag to reorder</p>
        </div>
        {onAdd && (
          <button onClick={onAdd}
            style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', background: '#ea6645', color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fa fa-plus" /> Add Question
          </button>
        )}
      </div>

      {questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: '#f5efe8', borderRadius: '12px', border: '2px dashed #e8ddd0' }}>
          <i className="fa fa-file-alt" style={{ fontSize: '32px', color: '#d1d5db', marginBottom: '12px' }} />
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>No questions yet. Click "Add Question" to start building your exam.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {questions.map((q, i) => (
              <SortableQuestion key={q.id} question={q} index={i} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

export type { Question };
