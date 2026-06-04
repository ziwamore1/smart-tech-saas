import { SUBJECT_PROMPTS, SUBJECT_SPECIFIC_INSTRUCTIONS } from './subject-prompts';

export interface EngineResponse {
  content: string;
  subject: string;
  topic?: string;
  suggestions?: string[];
  practiceQuestions?: string[];
}

export class BaseSubjectEngine {
  readonly subject: string;
  readonly aliases: string[];

  constructor(subject: string, aliases: string[] = []) {
    this.subject = subject;
    this.aliases = aliases;
  }

  matches(input: string): boolean {
    const lower = input.toLowerCase();
    return [this.subject, ...this.aliases].some(a => lower.includes(a));
  }

  getSystemPrompt(): string {
    return SUBJECT_PROMPTS[this.subject] || '';
  }

  getSubjectInstructions(): string {
    return SUBJECT_SPECIFIC_INSTRUCTIONS[this.subject] || '';
  }

  async preprocessQuery(query: string, context?: any): Promise<string> {
    return query;
  }

  async postprocessResponse(response: string, query: string): Promise<EngineResponse> {
    return { content: response, subject: this.subject };
  }

  async generatePracticeQuestion(topic: string, difficulty: number = 1): Promise<string> {
    return '';
  }

  async checkAnswer(question: string, studentAnswer: string): Promise<{ correct: boolean; feedback: string }> {
    return { correct: false, feedback: '' };
  }

  getDifficultyLabel(level: number): string {
    if (level <= 2) return 'Beginner';
    if (level <= 4) return 'Intermediate';
    if (level <= 6) return 'Advanced';
    return 'Expert';
  }
}

export function resolveEngine(subjectIdOrName: string, engines: BaseSubjectEngine[]): BaseSubjectEngine | null {
  const lower = subjectIdOrName.toLowerCase();
  for (const engine of engines) {
    if (engine.matches(lower)) return engine;
  }
  return null;
}
