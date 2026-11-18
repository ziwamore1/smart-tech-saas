export type BlueprintAnswerRule = 'ALL' | 'ONE' | 'ANY';
export type BlueprintResponseType = 'STRUCTURED' | 'ESSAY' | 'OBJECTIVE' | 'MULTIPLE_CHOICE' | 'PRACTICAL' | 'DRAWING';
export type BlueprintTaskPattern = 'SINGLE_TASK' | 'MULTI_TASK';
export type BlueprintMarkingMethod = 'ANALYTIC' | 'HOLISTIC' | 'OBJECTIVE_KEY';

export interface BlueprintSectionInput {
  id?: string;
  code: string;
  title: string;
  instructions?: string;
  totalMarks: number;
  itemCount: number;
  answerRule: BlueprintAnswerRule;
  responseType?: BlueprintResponseType;
  taskPattern?: BlueprintTaskPattern;
  markingMethod?: BlueprintMarkingMethod;
  candidateAnswerSpace?: 'NONE' | 'LINED' | 'GRID' | 'DIAGRAM';
  questionTypes?: string[];
}

export interface BlueprintSection extends Omit<BlueprintSectionInput, 'id' | 'responseType' | 'taskPattern' | 'markingMethod' | 'candidateAnswerSpace'> {
  id: string;
  responseType: BlueprintResponseType;
  taskPattern: BlueprintTaskPattern;
  markingMethod: BlueprintMarkingMethod;
  candidateAnswerSpace: 'NONE' | 'LINED' | 'GRID' | 'DIAGRAM';
}

export interface BlueprintStructure {
  totalMarks: number;
  durationMinutes: number;
  sections: BlueprintSection[];
  topicPlan?: Array<{ topic: string; marks: number; questionCount?: number }>;
  cognitiveDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
}

export type BlueprintStructureInput = Omit<BlueprintStructure, 'sections'> & { sections: BlueprintSectionInput[] };

export function normalizeBlueprintStructure(input: any): BlueprintStructure {
  const sections = Array.isArray(input?.sections) ? input.sections : [];
  const normalizedSections = sections.map((section: any, index: number) => ({
    id: String(section.id || `${section.code || 'section'}-${index + 1}`).trim(),
    code: String(section.code || String.fromCharCode(65 + index)).trim(),
    title: String(section.title || `Section ${String.fromCharCode(65 + index)}`).trim(),
    instructions: section.instructions ? String(section.instructions) : undefined,
    totalMarks: Number(section.totalMarks || 0),
    itemCount: Number(section.itemCount || 0),
    answerRule: section.answerRule || 'ALL',
    responseType: section.responseType || (section.questionTypes?.includes('ESSAY') ? 'ESSAY' : 'STRUCTURED'),
    taskPattern: section.taskPattern || 'MULTI_TASK',
    markingMethod: section.markingMethod || 'ANALYTIC',
    candidateAnswerSpace: section.candidateAnswerSpace || 'LINED',
    questionTypes: Array.isArray(section.questionTypes)
      ? section.questionTypes
      : section.responseType === 'MULTIPLE_CHOICE' ? ['MULTIPLE_CHOICE'] : undefined,
  }));

  return {
    totalMarks: Number(input?.totalMarks || 0),
    durationMinutes: Number(input?.durationMinutes || 0),
    sections: normalizedSections,
    topicPlan: input?.topicPlan,
    cognitiveDistribution: input?.cognitiveDistribution,
    difficultyDistribution: input?.difficultyDistribution,
  };
}
