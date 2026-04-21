import { SlotIndex, EntityId } from '../entities/cache';

export type Intent =
  | 'FIX_CONFLICTS'
  | 'REDUCE_GAPS'
  | 'BALANCE_SUBJECTS'
  | 'BALANCE_DAYS'
  | 'MOVE_LESSON'
  | 'MOVE_SUBJECT'
  | 'OPTIMIZE_FULL'
  | 'OPTIMIZE_TEACHER'
  | 'AVOID_LATE'
  | 'AVOID_MORNING'
  | 'DISTRIBUTE_EVENLY'
  | 'GROUP_CONSECUTIVE'
  | 'SET_DEFAULT';

export interface ParsedCommand {
  action: Intent;
  target?: string;
  targetType?: 'subject' | 'teacher' | 'class' | 'room';
  constraints?: ActionConstraints;
  priority?: number;
}

export interface ActionConstraints {
  avoid?: {
    day?: number;
    dayName?: string;
    period?: number;
    slot?: SlotIndex;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
  };
  prefer?: {
    day?: number;
    dayName?: string;
    period?: number;
    slot?: SlotIndex;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
  };
  maxGaps?: number;
  minLessonsPerDay?: number;
  maxLessonsPerDay?: number;
}

export interface AIResponse {
  success: boolean;
  changes: AppliedChange[];
  explanation: string;
  suggestions?: string[];
  conflictsFixed?: number;
  gapsReduced?: number;
  beforeScore?: number;
  afterScore?: number;
}

export interface AppliedChange {
  lessonId: string;
  fromSlot: SlotIndex;
  toSlot: SlotIndex;
  reason: string;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  intent: Intent;
  impact: 'high' | 'medium' | 'low';
  estimatedImprovement: number;
}

export interface LearningRecord {
  input: string;
  intent: Intent;
  accepted: boolean;
  improvedScore?: number;
  timestamp: number;
}

export interface TimetableAnalysis {
  conflicts: ConflictInfo[];
  teacherGaps: Map<string, number[]>;
  subjectDistribution: Map<string, Map<number, number>>;
  lateLessons: number;
  morningLessons: number;
  overloadedTeachers: string[];
  unbalancedDays: string[];
  overallScore: number;
}

export interface ConflictInfo {
  lessonId: string;
  type: 'teacher' | 'class' | 'room';
  slot: SlotIndex;
  conflictingWith: string;
}

export interface CommandHistory {
  commands: ParsedCommand[];
  responses: AIResponse[];
}
