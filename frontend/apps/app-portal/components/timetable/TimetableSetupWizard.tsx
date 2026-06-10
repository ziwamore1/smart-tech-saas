"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classApi, subjectApi, teacherApi, timetableApi, schoolApi, api } from '@/lib/api';

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function Dialog({ open, onOpenChange, children }: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  children: React.ReactNode 
}) {
  if (!open) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}
    >
      {children}
    </div>
  );
}

function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-auto ${className || ''}`}>
      {children}
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termId: string;
  classId?: string;
};

type SessionType = 'MORNING' | 'AFTERNOON' | 'EVENING';
type WizardStep = 'structure' | 'classes' | 'requirements' | 'generate' | 'preview';

interface TimeConfig {
  startTime: string;
  periodDuration: number;
  periodsPerDay: number;
  daysPerWeek: number;
  breakAfterPeriod: number;
}

interface TimetableSlot {
  id: string;
  day: number;
  period: number;
  subjectId: string;
  teacherId: string;
  subject?: { name: string; color: string };
  teacher?: { id: string; user: { firstName: string; lastName: string } };
}

interface TimetableData {
  id: string;
  classId: string;
  sessionType: SessionType;
  status: 'DRAFT' | 'PUBLISHED';
  startTime: string;
  periodsPerDay: number;
  daysPerWeek: number;
  breakAfterPeriod: number;
  slots: TimetableSlot[];
}

const DEFAULT_CONFIG: TimeConfig = {
  startTime: '07:30',
  periodDuration: 40,
  periodsPerDay: 7,
  daysPerWeek: 5,
  breakAfterPeriod: 3,
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SESSION_OPTIONS: { value: SessionType; label: string; icon: string }[] = [
  { value: 'MORNING', label: 'Morning', icon: '☀️' },
  { value: 'AFTERNOON', label: 'Afternoon', icon: '🌇' },
  { value: 'EVENING', label: 'Evening', icon: '🌙' },
];

export default function TimetableSetupWizard({ open, onOpenChange, termId, classId }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>('structure');
  const [sessionType, setSessionType] = useState<SessionType>('MORNING');
  const [config, setConfig] = useState<TimeConfig>(DEFAULT_CONFIG);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<{ day: number; period: number } | null>(null);

  const { data: timeSettings } = useQuery({
    queryKey: ['schoolTimeSettings'],
    queryFn: () => schoolApi.getTimeSettings().then(res => res.data),
    enabled: open,
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classApi.getAll().then(res => res.data?.data || res.data || []),
    enabled: open,
  });

  const classes = classesData || [];

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(res => res.data),
    enabled: open,
  });

const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const res = await teacherApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: open,
  });

  const teachers = teachersData || [];

  const generateMutation = useMutation({
    mutationFn: (data: { classId: string; termId: string }) => timetableApi.generateTimetable(data.classId, data.termId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classTimetable'] }),
  });

  const publishMutation = useMutation({
    mutationFn: (timetableId: string) => timetableApi.publishTimetable(timetableId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classTimetable'] }),
  });

  const updateTimeConfig = useCallback(async (newConfig: Partial<TimeConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    try {
      await schoolApi.updateTimeSettings(updated);
    } catch (error) {
      console.error('Failed to save time settings:', error);
    }
  }, [config]);

  const getPeriodTime = (period: number): string => {
    const [hours, minutes] = config.startTime.split(':').map(Number);
    const periodMinutes = (period - 1) * config.periodDuration;
    const totalMinutes = hours * 60 + minutes + periodMinutes;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const handleCellClick = (day: number, period: number) => {
    if (!timetableData?.slots) return;
    const existing = timetableData.slots.find(
      s => s.day === day && s.period === period
    );
    if (existing) {
      setEditingSlot({ day, period });
      setSlotModalOpen(true);
    } else {
      setEditingSlot({ day, period });
      setSlotModalOpen(true);
    }
  };

  const renderPeriodTimeline = () => {
    const cols = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1).flatMap(p =>
      p === config.breakAfterPeriod
        ? [{ type: 'period' as const, period: p }, { type: 'break' as const }]
        : [{ type: 'period' as const, period: p }]
    )
    return cols.map((col, idx) => {
      if (col.type === 'break') {
        return (
          <div
            key={`break-${idx}`}
            onClick={() => setBreakModalOpen(true)}
            className="flex-1 text-center py-2 px-1 text-xs font-medium border-l first:border-l-0 bg-amber-100 text-amber-700 border-amber-300 cursor-pointer hover:bg-amber-200"
          >
            <div>Break</div>
            <div className="text-[10px] opacity-70">Recess</div>
          </div>
        )
      }
      const time = getPeriodTime(col.period);
      return (
        <div
          key={col.period}
          onClick={() => setBreakModalOpen(true)}
          className="flex-1 text-center py-2 px-1 text-xs font-medium border-l first:border-l-0 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
        >
          <div>P{col.period}</div>
          <div className="text-[10px] opacity-70">{time}</div>
        </div>
      );
    });
  };

  const renderTimetableGrid = () => {
    const cols = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1).flatMap(p =>
      p === config.breakAfterPeriod
        ? [{ type: 'period' as const, period: p }, { type: 'break' as const }]
        : [{ type: 'period' as const, period: p }]
    )
    const cells = [];
    for (let day = 1; day <= config.daysPerWeek; day++) {
      for (const col of cols) {
        if (col.type === 'break') {
          cells.push(
            <div
              key={`${day}-break-${col.period}`}
              className="min-h-[60px] border-r border-b p-1 bg-amber-50"
            >
              <div className="flex items-center justify-center h-full text-amber-400 text-xs">
                Break
              </div>
            </div>
          )
          continue
        }
        const slot = timetableData?.slots?.find(
          s => s.day === day && s.period === col.period
        );
        cells.push(
          <div
            key={`${day}-${col.period}`}
            onClick={() => handleCellClick(day, col.period)}
            className={cn(
              'min-h-[60px] border-r border-b p-1 cursor-pointer transition',
              slot 
                ? 'bg-white hover:bg-blue-50' 
                : 'bg-gray-50 hover:bg-gray-100'
            )}
          >
            {slot ? (
              <div className="text-[10px]">
                <div 
                  className="font-medium text-[11px]"
                  style={{ color: slot.subject?.color || '#333' }}
                >
                  {slot.subject?.name || 'Subject'}
                </div>
                <div className="text-gray-500 truncate">
                  {slot.teacher ? `${slot.teacher.user?.firstName || ''} ${slot.teacher.user?.lastName || ''}`.trim() || 'Teacher' : 'Teacher'}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300 text-xs">
                + Add
              </div>
            )}
          </div>
        );
      }
    }
    return cells;
  };

  const steps: { key: WizardStep; label: string; icon: string }[] = [
    { key: 'structure', label: 'Structure', icon: '⚙️' },
    { key: 'classes', label: 'Classes', icon: '🏫' },
    { key: 'requirements', label: 'Requirements', icon: '📋' },
    { key: 'generate', label: 'Generate', icon: '🤖' },
    { key: 'preview', label: 'Preview', icon: '👁️' },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-[90vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Timetable Setup Wizard</h2>
                <p className="text-indigo-100 text-sm">Interactive timetable configuration</p>
              </div>
              <div className="flex gap-2">
                {SESSION_OPTIONS.map(session => (
                  <button
                    key={session.value}
                    onClick={() => setSessionType(session.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition',
                      sessionType === session.value
                        ? 'bg-white text-indigo-600'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    )}
                  >
                    {session.icon} {session.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-1 mt-4">
              {steps.map((s, index) => (
                <div key={s.key} className="flex items-center flex-1">
                  <button
                    onClick={() => setStep(s.key)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition flex-1',
                      step === s.key
                        ? 'bg-white text-indigo-600'
                        : index <= currentStepIndex
                          ? 'bg-white/20 text-white hover:bg-white/30'
                          : 'bg-white/10 text-white/50'
                    )}
                  >
                    <span>{s.icon}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className="w-4 h-0.5 bg-white/30 mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden p-4">
            {step === 'structure' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                {/* Left Panel - Time Config */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="font-semibold mb-4">Time Structure</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Start Time</label>
                        <input
                          type="time"
                          value={config.startTime}
                          onChange={e => updateTimeConfig({ startTime: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Period Duration (min)</label>
                        <input
                          type="number"
                          value={config.periodDuration}
                          onChange={e => updateTimeConfig({ periodDuration: +e.target.value })}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Periods Per Day</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={config.periodsPerDay}
                          onChange={e => updateTimeConfig({ periodsPerDay: +e.target.value })}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Days Per Week</label>
                        <input
                          type="number"
                          min="1"
                          max="7"
                          value={config.daysPerWeek}
                          onChange={e => updateTimeConfig({ daysPerWeek: +e.target.value })}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setBreakModalOpen(true)}
                      className="mt-4 w-full py-2 px-4 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition"
                    >
                      Configure Break → After Period {config.breakAfterPeriod}
                    </button>
                  </div>

                  {/* Period Timeline */}
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="font-semibold mb-4">Period Timeline</h3>
                    <div className="flex">
                      {renderPeriodTimeline()}
                    </div>
                  </div>
                </div>

                {/* Right Panel - Preview */}
                <div className="bg-white rounded-xl border p-4 overflow-auto">
                  <h3 className="font-semibold mb-4">Live Preview</h3>
                  <div className="text-sm text-gray-500 mb-4">
                    {config.periodsPerDay} periods × {config.daysPerWeek} days = {config.periodsPerDay * config.daysPerWeek} slots
                  </div>
                  {(() => {
                    const cols = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1).flatMap(p =>
                      p === config.breakAfterPeriod
                        ? [{ type: 'period' as const, period: p }, { type: 'break' as const }]
                        : [{ type: 'period' as const, period: p }]
                    )
                    return (
                      <div className="grid border" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
                        {/* Header row */}
                        <div className="bg-gray-100 p-2 font-medium text-xs">Day</div>
                        {cols.map((col, idx) => {
                          if (col.type === 'break') {
                            return (
                              <div key={`break-h-${idx}`} className="bg-amber-50 p-2 text-center font-medium text-xs text-amber-600">
                                Break
                              </div>
                            )
                          }
                          return (
                            <div key={`h-${col.period}`} className="bg-gray-100 p-2 text-center font-medium text-xs">
                              {col.period}
                            </div>
                          )
                        })}
                        {/* Data rows */}
                        {DAY_NAMES.slice(0, config.daysPerWeek).map((day, dayIdx) => [
                          <div key={`label-${day}`} className="bg-gray-100 p-2 font-medium text-xs">
                            {day}
                          </div>,
                          ...cols.map((col, idx) => {
                            if (col.type === 'break') {
                              return (
                                <div key={`break-${dayIdx}-${idx}`} className="p-2 border-l border-t text-xs bg-amber-50">
                                  <span className="text-amber-400">Break</span>
                                </div>
                              )
                            }
                            return (
                              <div key={`${day}-${col.period}`} className="p-2 border-l border-t text-xs bg-gray-50">
                                <span className="text-gray-300">--</span>
                              </div>
                            )
                          })
                        ])}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {step === 'classes' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold mb-4">Select Class</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {(classes as any[]).map((cls: any) => (
                      <button
                        key={cls.id}
                        onClick={() => setSelectedClassId(cls.id)}
                        className={cn(
                          'p-4 rounded-xl border-2 transition text-left',
                          selectedClassId === cls.id
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-gray-200 hover:border-indigo-300'
                        )}
                      >
                        <div className="font-medium">{cls.name}</div>
                        <div className="text-sm text-gray-500">{cls.levelType?.name || 'Class'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 'requirements' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="font-semibold mb-4">Lesson Requirements</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Set how many lessons per week each subject requires for the selected class.
                  </p>
                  <div className="text-center py-8 text-gray-400">
                    Configure lesson requirements in the Lesson Requirements panel
                  </div>
                </div>
              </div>
            )}

            {step === 'generate' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border p-6 text-center">
                  <h3 className="font-semibold text-lg mb-2">Generate Timetable</h3>
                  <p className="text-gray-500 mb-4">
                    AI will create an optimized timetable based on your configuration and requirements.
                  </p>
                  <button
                    onClick={() => selectedClassId && generateMutation.mutate({ classId: selectedClassId, termId })}
                    disabled={!selectedClassId || generateMutation.isPending}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
                  >
                    {generateMutation.isPending ? 'Generating...' : '🤖 Generate with AI'}
                  </button>
                </div>
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      timetableData?.status === 'PUBLISHED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {timetableData?.status || 'No Timetable'}
                    </span>
                  </div>
                  {timetableData && (
                    <button
                      onClick={() => publishMutation.mutate(timetableData.id)}
                      disabled={publishMutation.isPending}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                    >
                      {publishMutation.isPending ? 'Publishing...' : 'Publish Timetable'}
                    </button>
                  )}
                </div>

                {(() => {
                  const cols = Array.from({ length: config.periodsPerDay }, (_, i) => i + 1).flatMap(p =>
                    p === config.breakAfterPeriod
                      ? [{ type: 'period' as const, period: p }, { type: 'break' as const }]
                      : [{ type: 'period' as const, period: p }]
                  )
                  return (
                    <div className="bg-white rounded-xl border overflow-auto">
                      <div className="grid" style={{ gridTemplateColumns: `60px repeat(${cols.length}, 1fr)` }}>
                        <div className="bg-gray-100 p-2 font-medium text-xs text-center">Day</div>
                        {cols.map((col, idx) => {
                          if (col.type === 'break') {
                            return (
                              <div key={`break-h-${idx}`} className="bg-amber-50 p-2 text-center font-medium text-xs text-amber-600">
                                Break
                              </div>
                            )
                          }
                          return (
                            <div key={`h-${col.period}`} className="bg-gray-100 p-2 text-center font-medium text-xs">
                              P{col.period}
                            </div>
                          )
                        })}
                        {DAY_NAMES.slice(0, config.daysPerWeek).map((day, dayIdx) => [
                          <div key={`label-${day}`} className="bg-gray-100 p-2 font-medium text-xs">
                            {day}
                          </div>,
                          ...cols.map((col, idx) => {
                            if (col.type === 'break') {
                              return (
                                <div key={`break-${dayIdx}-${idx}`} className="min-h-[60px] p-1 border-l border-t bg-amber-50">
                                  <div className="flex items-center justify-center h-full text-amber-400 text-xs">Break</div>
                                </div>
                              )
                            }
                            const slot = timetableData?.slots?.find(
                              s => s.day === dayIdx + 1 && s.period === col.period
                            );
                            return (
                              <div
                                key={`${day}-${col.period}`}
                                onClick={() => handleCellClick(dayIdx + 1, col.period)}
                                className={cn(
                                  'min-h-[60px] p-1 border-l border-t cursor-pointer transition',
                                  slot
                                    ? 'bg-white hover:bg-blue-50'
                                    : 'bg-gray-50 hover:bg-gray-100'
                                )}
                              >
                                {slot ? (
                                  <div className="text-[10px]">
                                    <div 
                                      className="font-medium text-[11px]"
                                      style={{ color: slot.subject?.color || '#333' }}
                                    >
                                      {slot.subject?.name || 'Sub'}
                                    </div>
                                    <div className="text-gray-500 truncate">
                                      {slot.teacher?.user ? `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}` : 'Tea'}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-full text-gray-300 text-xs">+</div>
                                )}
                              </div>
                            );
                          })
                        ])}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4 flex items-center justify-between">
            <button
              onClick={() => {
                const idx = steps.findIndex(s => s.key === step);
                if (idx > 0) setStep(steps[idx - 1].key);
              }}
              disabled={step === 'structure'}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              ← Previous
            </button>
            <div className="text-sm text-gray-500">
              Step {currentStepIndex + 1} of {steps.length}
            </div>
            <button
              onClick={() => {
                const idx = steps.findIndex(s => s.key === step);
                if (idx < steps.length - 1) setStep(steps[idx + 1].key);
              }}
              disabled={step === 'preview'}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Break Configuration Modal */}
        <Dialog open={breakModalOpen} onOpenChange={setBreakModalOpen}>
          <DialogContent className="max-w-md">
            <h3 className="text-lg font-semibold mb-4">Configure Break</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Break After Period</label>
                <select
                  value={config.breakAfterPeriod}
                  onChange={e => {
                    updateTimeConfig({ breakAfterPeriod: +e.target.value });
                    setBreakModalOpen(false);
                  }}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                >
                  {Array.from({ length: config.periodsPerDay - 1 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      After Period {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setBreakModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Slot Assignment Modal */}
        <Dialog open={slotModalOpen} onOpenChange={setSlotModalOpen}>
          <DialogContent className="max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingSlot ? `Period ${editingSlot.period}, Day ${editingSlot.day}` : 'Assign Lesson'}
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Select subject and teacher for this slot.
              </p>
              <div className="text-center py-8 text-gray-400">
                Subject/Teacher selection coming soon
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSlotModalOpen(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}