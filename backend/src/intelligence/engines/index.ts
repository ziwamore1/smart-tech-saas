import { BaseSubjectEngine, resolveEngine } from './base-engine';
import { MathEngine } from './math-engine';
import { ScienceEngine } from './science-engine';
import { LanguageEngine } from './language-engine';
import { HumanitiesEngine } from './humanities-engine';
import { SUBJECT_PROMPTS, SUBJECT_SPECIFIC_INSTRUCTIONS } from './subject-prompts';

export { BaseSubjectEngine, EngineResponse } from './base-engine';
export { MathEngine } from './math-engine';
export { ScienceEngine } from './science-engine';
export { LanguageEngine } from './language-engine';
export { HumanitiesEngine } from './humanities-engine';

const DEFAULT_ENGINES: BaseSubjectEngine[] = [
  new MathEngine(),
  new ScienceEngine(),
  new LanguageEngine(),
  new HumanitiesEngine(),
];

export function getEngineForSubject(subjectIdOrName: string): BaseSubjectEngine | null {
  return resolveEngine(subjectIdOrName, DEFAULT_ENGINES);
}

export function getAllEngines(): BaseSubjectEngine[] {
  return DEFAULT_ENGINES;
}

export function getSubjectSystemPrompt(subject: string): string {
  const engine = getEngineForSubject(subject);
  if (engine) {
    const prompt = engine.getSystemPrompt();
    const instructions = engine.getSubjectInstructions();
    if (prompt) return `${prompt}\n\n${instructions}`.trim();
  }
  const directPrompt = SUBJECT_PROMPTS[subject];
  if (directPrompt) {
    const directInstructions = SUBJECT_SPECIFIC_INSTRUCTIONS[subject] || '';
    return directInstructions
      ? `${directPrompt}\n\n${directInstructions}`.trim()
      : directPrompt;
  }
  return '';
}
