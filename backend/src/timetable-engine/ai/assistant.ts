import { TimetableCache, SlotIndex } from '../entities/cache';
import { Lesson } from '../solver/fastCSPSolver';
import { parseIntent, parseConstraintFromNLP } from './intentParser';
import { ActionEngine, TimetableData, analyzeTimetable } from './actionEngine';
import { generateSuggestions } from './suggestions';
import { 
  ParsedCommand, 
  AIResponse, 
  Suggestion, 
  Intent,
  LearningRecord,
  CommandHistory 
} from './types';

export interface AssistantConfig {
  enableLearning: boolean;
  defaultWeights?: Record<string, number>;
}

export class TimetableAssistant {
  private actionEngine: ActionEngine;
  private history: CommandHistory;
  private learningRecords: LearningRecord[] = [];
  private config: AssistantConfig;

  constructor(config: AssistantConfig = { enableLearning: true }) {
    this.actionEngine = new ActionEngine();
    this.history = { commands: [], responses: [] };
    this.config = config;
  }

  async processInput(
    input: string,
    timetable: TimetableData
  ): Promise<AIResponse> {
    const command = parseIntent(input);
    
    const additionalConstraints = parseConstraintFromNLP(input);
    if (Object.keys(additionalConstraints).length > 0) {
      command.constraints = {
        ...command.constraints,
        ...additionalConstraints,
      };
    }

    this.history.commands.push(command);

    const response = await this.actionEngine.handleIntent(command, timetable);

    this.history.responses.push(response);

    if (this.config.enableLearning) {
      this.learningRecords.push({
        input,
        intent: command.action,
        accepted: false,
        timestamp: Date.now(),
      });
    }

    return response;
  }

  async suggestImprovements(
    timetable: TimetableData
  ): Promise<Suggestion[]> {
    return generateSuggestions(timetable.lessons, timetable.cache);
  }

  async analyze(
    timetable: TimetableData
  ) {
    return analyzeTimetable(timetable);
  }

  markAccepted(input: string) {
    const record = this.learningRecords.find(r => r.input === input);
    if (record) {
      record.accepted = true;
    }
  }

  getHistory(): CommandHistory {
    return { ...this.history };
  }

  getLearningInsights(): {
    mostUsed: Intent;
    acceptanceRate: number;
    popularCommands: Intent[];
  } {
    const intentCounts = new Map<Intent, number>();
    let accepted = 0;

    for (const record of this.learningRecords) {
      const count = intentCounts.get(record.intent) || 0;
      intentCounts.set(record.intent, count + 1);
      if (record.accepted) accepted++;
    }

    let mostUsed: Intent = 'OPTIMIZE_FULL';
    let maxCount = 0;
    const popularCommands: Intent[] = [];

    for (const [intent, count] of intentCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostUsed = intent;
      }
      popularCommands.push(intent);
    }

    popularCommands.sort((a, b) => 
      (intentCounts.get(b) || 0) - (intentCounts.get(a) || 0)
    );

    return {
      mostUsed,
      acceptanceRate: this.learningRecords.length > 0 
        ? accepted / this.learningRecords.length 
        : 0,
      popularCommands: popularCommands.slice(0, 5),
    };
  }

  clearHistory() {
    this.history = { commands: [], responses: [] };
  }
}

export function createAssistant(config?: AssistantConfig): TimetableAssistant {
  return new TimetableAssistant(config);
}

export function quickFix(
  lessons: Lesson[],
  slots: SlotIndex[],
  cache: TimetableCache,
  intent: Intent
): AIResponse {
  const assistant = createAssistant({ enableLearning: false });
  const timetable: TimetableData = { lessons, slots, cache };

  const intentMap: Record<Intent, string> = {
    FIX_CONFLICTS: 'fix conflicts',
    REDUCE_GAPS: 'reduce gaps',
    BALANCE_SUBJECTS: 'balance subjects',
    BALANCE_DAYS: 'balance days',
    MOVE_LESSON: 'move lesson',
    MOVE_SUBJECT: 'move subject',
    OPTIMIZE_FULL: 'optimize',
    OPTIMIZE_TEACHER: 'optimize teacher',
    AVOID_LATE: 'avoid late',
    AVOID_MORNING: 'avoid morning',
    DISTRIBUTE_EVENLY: 'distribute evenly',
    GROUP_CONSECUTIVE: 'group consecutive',
    SET_DEFAULT: 'set default',
  };

  return assistant.processInput(intentMap[intent] || 'optimize', timetable);
}
