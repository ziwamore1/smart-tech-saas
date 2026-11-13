import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { ExaminationComposer } from '../exam-authoring/examination-composer';

export interface AiExaminorSectionRequest {
  code: string;
  title: string;
  totalMarks: number;
  itemCount: number;
  answerRule: 'ALL' | 'ONE' | 'ANY';
  questionTypes?: string[];
}

export interface AiExaminorRequest {
  schoolId?: string;
  subjectId: string;
  academicStageId?: string;
  totalMarks?: number;
  durationMinutes?: number;
  title?: string;
  sections?: AiExaminorSectionRequest[];
  includeTopics?: string[];
  includeEocs?: string[];
  difficultyDistribution?: Record<string, number>;
  cognitiveDistribution?: Record<string, number>;
  topicPlan?: Array<{ topic: string; marks: number; questionCount?: number }>;
  instruction?: string;
}

const SYSTEM_PROMPT = `You are AI-EXAMINOR, the examination authoring and marking-key specialist for Zambia CBC/ECZ examinations.
Create a fair, syllabus-grounded examination for any subject. Use only the supplied curriculum evidence. Do not invent syllabus codes or claim alignment that is not present.
Respect every section's answer rule and exact mark budget. Questions must be candidate-ready, culturally appropriate, unambiguous, and use measurable command verbs.
Follow ECZ item conventions: a question stem introduces one coherent scenario or data set; the tasks beneath it are separately labelled subquestions such as (a), (b), (c). Each task must be independently assessable, carry its own bracketed mark tariff, and never repeat the parent stem. A 10-mark or 20-mark structured item should normally have two or more meaningful tasks unless the assessment demand genuinely justifies one task. Use contexts that require method, accuracy, reasoning, interpretation or communication marks where appropriate. Distribute the section's marks across tasks.
The marking key must show the expected answer and mark allocation for every task, including method marks, acceptable alternatives and common errors where relevant. Keep marking keys examiner-only.
Return JSON only with: {"sections":[{"code":"","title":"","instructions":"","questions":[{"number":1,"type":"STRUCTURED","stem":"","marks":0,"difficulty":"MEDIUM","bloomLevel":"APPLY","topic":"","competency":"","tasks":[{"label":"(a)","prompt":"","marks":0}],"traceability":[{"source":"","evidence":""}],"markingKey":[{"task":"(a)","answer":"","markAllocation":[{"marks":1,"criterion":""}],"acceptableAlternatives":[]}]}]}],"metadata":{"assumptions":[],"qualityChecks":[]}}
Do not include answers in the candidate stem. Cover the supplied topic plan and cognitive distribution instead of reusing one topic or one command verb for the whole paper.`;

@Injectable()
export class AiExaminorService {
  private readonly composer = new ExaminationComposer();
  private readonly logger = new Logger(AiExaminorService.name);
  private readonly openai?: OpenAI;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) this.openai = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });
  }

  getProviderStatus() {
    return {
      providers: [{ id: 'openai', name: 'OpenAI', configured: Boolean(this.openai), model: this.config.get<string>('OPENAI_EXAMINOR_MODEL') || 'gpt-4o' }],
      generationAvailable: Boolean(this.openai),
    };
  }

  async generate(request: AiExaminorRequest, options: { requireProvider?: boolean } = {}) {
    if (options.requireProvider && !this.openai) throw new ServiceUnavailableException('AI-EXAMINOR generation requires a configured AI provider');
    const blueprint = this.normaliseBlueprint(request);
    const curriculum = await this.loadCurriculum(request);
    if (!curriculum.subject) throw new BadRequestException('Subject not found');
    let artifact = this.buildFallback(blueprint, curriculum);

    if (this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: this.config.get<string>('OPENAI_EXAMINOR_MODEL') || 'gpt-4o',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ blueprint, curriculum, instruction: request.instruction || null }) },
          ],
        });
        const raw = response.choices[0]?.message?.content;
        if (raw) {
          const candidate = this.parseJson(raw);
          if (this.matchesBlueprintShape(candidate, blueprint) && this.isCandidateReady(candidate)) artifact = candidate;
          else this.logger.warn('AI-EXAMINOR returned an incomplete or blueprint-mismatched paper; using deterministic composer.');
        }
      } catch (error) {
        this.logger.warn(`AI-EXAMINOR enrichment failed; using validated fallback: ${(error as Error).message}`);
      }
    }
    return this.validateArtifact(artifact, blueprint, curriculum);
  }

  private normaliseBlueprint(request: AiExaminorRequest) {
    const sections = request.sections?.length ? request.sections : [
      { code: 'A', title: 'Section A', totalMarks: 80, itemCount: 4, answerRule: 'ALL' as const, questionTypes: ['STRUCTURED'] },
      { code: 'B', title: 'Section B', totalMarks: 20, itemCount: 2, answerRule: 'ONE' as const, questionTypes: ['STRUCTURED', 'ESSAY'] },
    ];
    const totalMarks = request.totalMarks ?? sections.reduce((sum, section) => sum + section.totalMarks, 0);
    if (totalMarks <= 0 || sections.some(section => section.totalMarks <= 0 || section.itemCount <= 0)) throw new BadRequestException('Exam marks and item counts must be positive');
    if (sections.reduce((sum, section) => sum + section.totalMarks, 0) !== totalMarks) throw new BadRequestException('Section marks must add up to totalMarks');
    return {
      title: request.title || 'CBC Examination Paper',
      totalMarks,
      durationMinutes: request.durationMinutes || 150,
      sections,
      topicPlan: request.topicPlan || [],
      cognitiveDistribution: request.cognitiveDistribution || {},
      difficultyDistribution: request.difficultyDistribution || { EASY: 0.2, MEDIUM: 0.5, HARD: 0.3 },
    };
  }

  private async loadCurriculum(request: AiExaminorRequest) {
    const subject = await this.prisma.subject.findFirst({
      where: { id: request.subjectId, ...(request.schoolId ? { schoolId: request.schoolId } : {}) },
      include: {
        Topic: { include: { competencies: true, learningOutcomes: true }, orderBy: { sortOrder: 'asc' } },
        SyllabusEntry: { orderBy: [{ formNumber: 'asc' }, { sourcePage: 'asc' }] },
      },
    });
    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: { subjectId: request.subjectId, ...(request.includeEocs?.length ? { id: { in: request.includeEocs } } : {}) },
      include: { competencies: true },
      orderBy: { sortOrder: 'asc' },
    });
    const topics = (subject?.Topic || []).filter(topic => !request.includeTopics?.length || request.includeTopics.includes(topic.id));
    return {
      subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
      topics: topics.map(topic => ({ id: topic.id, name: topic.name, competencies: topic.competencies.map(c => ({ id: c.id, name: c.name, description: c.description, bloomLevel: c.bloomLevel })) })),
      eocs: eocs.map(eoc => ({ id: eoc.id, name: eoc.name, competencies: eoc.competencies.map(c => c.name) })),
      syllabusEntries: (subject?.SyllabusEntry || []).map(entry => ({ code: entry.competencyCode, topic: entry.topic, competency: entry.competency, standard: entry.expectedStandard, sourcePage: entry.sourcePage })),
    };
  }

  private buildFallback(blueprint: any, curriculum: any) {
    return this.composer.compose(blueprint, curriculum);
  }

  private matchesBlueprintShape(artifact: any, blueprint: any) {
    if (!artifact || !Array.isArray(artifact.sections) || artifact.sections.length !== blueprint.sections.length) return false;
    return artifact.sections.every((section: any, index: number) => {
      const expected = blueprint.sections[index];
      if (!Array.isArray(section.questions) || section.questions.length !== expected.itemCount) return false;
      return expected.answerRule === 'ONE'
        ? section.questions.every((question: any) => Number(question.marks || 0) === expected.totalMarks)
        : section.questions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0) === expected.totalMarks;
    });
  }

  private isCandidateReady(artifact: any) {
    const questions = artifact.sections.flatMap((section: any) => section.questions || []);
    if (!questions.length) return false;
    const stems = questions.map((question: any) => this.normalise(question.stem));
    if (new Set(stems).size !== stems.length) return false;
    return questions.every((question: any, index: number) => {
      const stem = stems[index];
      const tasks = Array.isArray(question.tasks) ? question.tasks : [];
      if (stem.length < 40 || tasks.length < this.minimumTaskCount(question)) return false;
      const prompts = tasks.map((task: any) => this.normalise(task.prompt));
      if (new Set(prompts).size !== prompts.length) return false;
      if (prompts.some(prompt => prompt.length < 12 || prompt === stem || this.isPlaceholderPrompt(prompt))) return false;
      const taskMarks = tasks.reduce((sum: number, task: any) => sum + Number(task.marks || 0), 0);
      if (taskMarks !== Number(question.marks || 0)) return false;
      return this.markingKeyCoversTasks(question, tasks);
    });
  }

  private minimumTaskCount(question: any) {
    return Number(question.marks || 0) >= 10 ? 2 : 1;
  }

  private isPlaceholderPrompt(prompt: string) {
    return /using the syllabus content|demonstrate the competency|show your working and give a clear final response|show the method, calculations and justification needed to answer the question|state the answer and justify your conclusion/i.test(prompt);
  }

  private markingKeyCoversTasks(question: any, tasks: any[]) {
    const keys = Array.isArray(question.markingKey) ? question.markingKey : [];
    if (!keys.length) return false;
    return tasks.every((task: any) => keys.some((key: any) => this.normalise(key.task) === this.normalise(task.label)));
  }

  private parseJson(raw: string) {
    try {
      return JSON.parse(raw.replace(/^```json\s*|```$/g, '').trim());
    } catch {
      throw new BadRequestException('AI-EXAMINOR returned invalid JSON');
    }
  }

  private validateArtifact(artifact: any, blueprint: any, curriculum: any) {
    if (!artifact || !Array.isArray(artifact.sections) || artifact.sections.length !== blueprint.sections.length) throw new BadRequestException('Generated paper does not match its section blueprint');
    const questions = artifact.sections.flatMap((section: any, index: number) => {
      const expected = blueprint.sections[index];
      if (!Array.isArray(section.questions) || section.questions.length !== expected.itemCount) throw new BadRequestException(`Section ${expected.code} has an invalid item count`);
      const sectionMarks = section.questions.reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);
      if (expected.answerRule === 'ONE' ? section.questions.some((question: any) => Number(question.marks || 0) !== expected.totalMarks) : sectionMarks !== expected.totalMarks) throw new BadRequestException(`Section ${expected.code} marks do not match its blueprint`);
      return section.questions;
    });
    const stems = new Set<string>();
    for (const question of questions) {
      if (!question.stem || !question.markingKey?.length || !question.tasks?.length) throw new BadRequestException('Every generated question requires tasks and a marking key');
      const normalizedStem = this.normalise(question.stem);
      if (stems.has(normalizedStem)) throw new BadRequestException(`Duplicate question text detected for question ${question.number}`);
      stems.add(normalizedStem);
      const tasks = question.tasks;
      if (tasks.length < this.minimumTaskCount(question)) throw new BadRequestException(`Question ${question.number} needs more than one independently assessable task for its mark tariff`);
      const prompts = tasks.map((task: any) => this.normalise(task.prompt));
      if (new Set(prompts).size !== prompts.length) throw new BadRequestException(`Question ${question.number} contains duplicate task prompts`);
      if (tasks.some((task: any) => Number(task.marks || 0) <= 0)) throw new BadRequestException(`Question ${question.number} has a task with invalid marks`);
      const labels = tasks.filter((task: any) => String(task.label || '').trim()).map((task: any) => this.normalise(task.label));
      if (labels.length && new Set(labels).size !== labels.length) throw new BadRequestException(`Question ${question.number} contains duplicate task labels`);
      const taskMarks = tasks.reduce((sum: number, task: any) => sum + Number(task.marks || 0), 0);
      const keyMarks = question.markingKey.reduce((sum: number, key: any) => sum + (key.markAllocation || []).reduce((inner: number, mark: any) => inner + Number(mark.marks || 0), 0), 0);
      if (tasks.some((task: any) => this.normalise(task.prompt) === normalizedStem)) throw new BadRequestException(`Question ${question.number} repeats its parent text as a task`);
      if (!this.markingKeyCoversTasks(question, tasks)) throw new BadRequestException(`Question ${question.number} marking key does not cover every task`);
      if (taskMarks !== Number(question.marks) || keyMarks !== taskMarks) throw new BadRequestException(`Question ${question.number} marking allocations do not equal its marks`);
    }
    return {
      title: blueprint.title,
      subject: curriculum.subject,
      durationMinutes: blueprint.durationMinutes,
      totalMarks: blueprint.totalMarks,
      sections: artifact.sections.map((section: any, index: number) => ({
        ...section,
        answerRule: blueprint.sections[index].answerRule,
        instructions: this.sectionInstructions(blueprint.sections[index].answerRule),
        questions: section.questions.map((question: any) => ({
          ...question,
          difficulty: question.difficulty || 'MEDIUM',
          bloomLevel: question.bloomLevel || 'APPLY',
          topic: question.topic || 'General syllabus content',
          competency: question.competency || 'Apply the assessed competency',
        })),
      })),
      markingKey: questions.flatMap((question: any) => question.markingKey.map((key: any) => ({ questionNumber: question.number, ...key }))),
      metadata: { ...artifact.metadata, generatedBy: 'AI-EXAMINOR', aiEnriched: Boolean(this.openai), blueprint },
    };
  }

  private sectionInstructions(answerRule: AiExaminorSectionRequest['answerRule']) {
    if (answerRule === 'ONE') return 'Answer one item in this section.';
    if (answerRule === 'ANY') return 'Answer the required number of items indicated by the examination instructions.';
    return 'Answer all items in this section.';
  }

  private normalise(value: any) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
