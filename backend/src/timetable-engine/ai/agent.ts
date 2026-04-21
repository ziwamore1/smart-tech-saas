import { TimetableCache, SlotIndex } from '../entities/cache';
import { Lesson, Assignment } from '../solver/fastCSPSolver';
import { generateTimetableHybrid } from '../solver/fastHybridSolver';
import { ActionEngine, TimetableData } from './actionEngine';
import { parseIntent, parseConstraintFromNLP } from './intentParser';
import { Intent, AIResponse, ParsedCommand } from './types';

export interface AgentPlanStep {
  action: string;
  params?: Record<string, any>;
  description: string;
}

export interface AgentContext {
  lessons: Lesson[];
  slots: SlotIndex[];
  cache: TimetableCache;
  timetable: Assignment[];
  score: number;
  metadata: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  plan: AgentPlanStep[];
  result: AIResponse;
  iterations: number;
  finalScore: number;
  explanation: string;
}

export interface Memory {
  pastCommands: string[];
  preferredConstraints: Record<string, any>;
  userPreferences: Map<string, any>;
  successRate: number;
}

export class TimetableAgent {
  private actionEngine: ActionEngine;
  private memory: Memory;
  private maxIterations = 10;
  private targetScore = 900;

  constructor() {
    this.actionEngine = new ActionEngine();
    this.memory = {
      pastCommands: [],
      preferredConstraints: {},
      userPreferences: new Map(),
      successRate: 1.0,
    };
  }

  async execute(input: string, context: AgentContext): Promise<AgentResult> {
    const plan = this.createPlan(input);
    
    let currentContext = { ...context };
    let iterations = 0;
    let lastResponse: AIResponse = {
      success: false,
      changes: [],
      explanation: '',
    };

    for (const step of plan) {
      if (iterations >= this.maxIterations) break;

      const result = await this.executeStep(step, currentContext);
      lastResponse = result;
      iterations++;

      if (!result.success) {
        break;
      }

      currentContext = this.updateContext(currentContext, result);
    }

    const finalScore = this.evaluate(currentContext);
    const explanation = this.generateExplanation(lastResponse, finalScore);

    this.updateMemory(input, lastResponse.success);

    return {
      success: lastResponse.success,
      plan,
      result: lastResponse,
      iterations,
      finalScore,
      explanation,
    };
  }

  createPlan(input: string): AgentPlanStep[] {
    const plan: AgentPlanStep[] = [];
    const text = input.toLowerCase();

    if (text.includes('create') || text.includes('generate') || text.includes('new')) {
      plan.push({
        action: 'GENERATE_BASE',
        description: 'Generate base timetable',
      });
    }

    if (text.includes('optimize') || text.includes('improve') || text.includes('best')) {
      plan.push({
        action: 'FIX_CONFLICTS',
        description: 'Fix all scheduling conflicts',
      });

      plan.push({
        action: 'REDUCE_GAPS',
        description: 'Reduce teacher gaps',
      });

      plan.push({
        action: 'BALANCE_SUBJECTS',
        description: 'Balance subject distribution',
      });

      plan.push({
        action: 'AVOID_LATE',
        description: 'Avoid late periods',
      });
    }

    if (text.includes('conflict') || text.includes('clash')) {
      plan.push({
        action: 'FIX_CONFLICTS',
        description: 'Fix scheduling conflicts',
      });
    }

    if (text.includes('gap')) {
      plan.push({
        action: 'REDUCE_GAPS',
        description: 'Reduce teacher gaps',
      });
    }

    if (text.includes('balance') || text.includes('distribute')) {
      plan.push({
        action: 'BALANCE_SUBJECTS',
        description: 'Balance subject distribution',
      });
    }

    if (text.includes('friday') || text.includes('monday') || text.includes('light')) {
      plan.push({
        action: 'BALANCE_DAYS',
        description: 'Balance day distribution',
      });
    }

    if (text.includes('late') || text.includes('last')) {
      plan.push({
        action: 'AVOID_LATE',
        description: 'Avoid late periods',
      });
    }

    if (plan.length === 0) {
      plan.push({
        action: 'OPTIMIZE_FULL',
        description: 'Full optimization',
      });
    }

    return plan;
  }

  private async executeStep(step: AgentPlanStep, context: AgentContext): Promise<AIResponse> {
    const timetableData: TimetableData = {
      lessons: context.lessons,
      slots: context.slots,
      cache: context.cache,
    };

    switch (step.action) {
      case 'GENERATE_BASE': {
        const result = generateTimetableHybrid(context.lessons, context.slots);
        return {
          success: result.success,
          changes: result.schedule?.map((a, i) => ({
            lessonId: a.lessonId,
            fromSlot: 0,
            toSlot: a.slot,
            reason: 'Generated',
          })) || [],
          explanation: result.success ? 'Timetable generated successfully' : 'Failed to generate',
        };
      }

      case 'FIX_CONFLICTS':
        return this.actionEngine.handleIntent(
          { action: 'FIX_CONFLICTS' },
          timetableData
        );

      case 'REDUCE_GAPS':
        return this.actionEngine.handleIntent(
          { action: 'REDUCE_GAPS', targetType: 'teacher' },
          timetableData
        );

      case 'BALANCE_SUBJECTS':
        return this.actionEngine.handleIntent(
          { action: 'BALANCE_SUBJECTS' },
          timetableData
        );

      case 'BALANCE_DAYS':
        return this.actionEngine.handleIntent(
          { action: 'BALANCE_DAYS' },
          timetableData
        );

      case 'AVOID_LATE':
        return this.actionEngine.handleIntent(
          { action: 'AVOID_LATE' },
          timetableData
        );

      case 'OPTIMIZE_FULL':
        return this.actionEngine.handleIntent(
          { action: 'OPTIMIZE_FULL' },
          timetableData
        );

      default:
        return {
          success: false,
          changes: [],
          explanation: `Unknown action: ${step.action}`,
        };
    }
  }

  private updateContext(context: AgentContext, result: AIResponse): AgentContext {
    if (result.changes.length > 0) {
      context.cache.reset();
      
      for (const lesson of context.lessons) {
        context.cache.initTeacher(lesson.teacherId);
        context.cache.initClass(lesson.classId);
        if (lesson.roomId) {
          context.cache.initRoom(lesson.roomId);
        }
      }

      for (const change of result.changes) {
        const lesson = context.lessons.find(l => l.id === change.lessonId);
        if (lesson) {
          context.cache.assignLesson(
            lesson.teacherId,
            lesson.classId,
            change.toSlot,
            lesson.roomId
          );
        }
      }
    }

    return context;
  }

  private evaluate(context: AgentContext): number {
    let score = 1000;
    let conflicts = 0;
    let gaps = 0;

    const teacherSlots = new Map<string, Set<number>>();

    for (const lesson of context.lessons) {
      const day = Math.floor(lesson.id.length / 8);
      if (!teacherSlots.has(lesson.teacherId)) {
        teacherSlots.set(lesson.teacherId, new Set());
      }
      teacherSlots.get(lesson.teacherId)!.add(day);
    }

    for (const days of teacherSlots.values()) {
      const sorted = [...days].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > 1) gaps++;
      }
    }

    score -= conflicts * 100;
    score -= gaps * 30;

    return Math.max(0, score);
  }

  private generateExplanation(result: AIResponse, score: number): string {
    const parts: string[] = [];

    if (result.conflictsFixed && result.conflictsFixed > 0) {
      parts.push(`Fixed ${result.conflictsFixed} conflicts`);
    }

    if (result.gapsReduced && result.gapsReduced > 0) {
      parts.push(`Reduced ${result.gapsReduced} teacher gaps`);
    }

    if (result.changes.length > 0) {
      parts.push(`Made ${result.changes.length} adjustments`);
    }

    if (parts.length === 0) {
      return result.explanation || 'Timetable optimized';
    }

    return parts.join('. ') + '.';
  }

  private updateMemory(command: string, success: boolean) {
    this.memory.pastCommands.push(command);
    
    if (this.memory.pastCommands.length > 100) {
      this.memory.pastCommands = this.memory.pastCommands.slice(-100);
    }

    const successCount = this.memory.pastCommands.filter(() => success).length;
    this.memory.successRate = successCount / this.memory.pastCommands.length;

    const constraints = parseConstraintFromNLP(command);
    Object.assign(this.memory.preferredConstraints, constraints);
  }

  getMemory(): Memory {
    return { ...this.memory };
  }

  clearMemory() {
    this.memory = {
      pastCommands: [],
      preferredConstraints: {},
      userPreferences: new Map(),
      successRate: 1.0,
    };
  }
}

export function createAgent(): TimetableAgent {
  return new TimetableAgent();
}
