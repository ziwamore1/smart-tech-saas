import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

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
  instruction?: string;
}

const SYSTEM_PROMPT = `You are AI-EXAMINOR, the examination authoring and marking-key specialist for Zambia CBC/ECZ examinations.
Create a fair, syllabus-grounded examination for any subject. Use only the supplied curriculum evidence. Do not invent syllabus codes or claim alignment that is not present.
Respect every section's answer rule and exact mark budget. Questions must be candidate-ready, culturally appropriate, unambiguous, and use measurable command verbs. Structured questions must have tasks with marks. The marking key must show the expected answer and mark allocation for every task, including acceptable alternatives and method marks where relevant.
Return JSON only with: {"sections":[{"code":"","title":"","instructions":"","questions":[{"number":1,"type":"STRUCTURED","stem":"","marks":0,"difficulty":"MEDIUM","bloomLevel":"APPLY","topic":"","competency":"","tasks":[{"label":"(a)","prompt":"","marks":0}],"traceability":[{"source":"","evidence":""}],"markingKey":[{"task":"(a)","answer":"","markAllocation":[{"marks":1,"criterion":""}],"acceptableAlternatives":[]}]}]}],"metadata":{"assumptions":[],"qualityChecks":[]}}
Do not include answers in the candidate stem. Keep markingKey examiner-only.`;

@Injectable()
export class AiExaminorService {
  private readonly logger = new Logger(AiExaminorService.name);
  private readonly openai?: OpenAI;

  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) this.openai = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });
  }

  getProviderStatus() {
    return { providers: [{ id: 'openai', name: 'OpenAI', configured: Boolean(this.openai), model: this.config.get<string>('OPENAI_EXAMINOR_MODEL') || 'gpt-4o' }], generationAvailable: Boolean(this.openai) };
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
        if (raw) artifact = this.parseJson(raw);
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
    return { title: request.title || 'CBC Examination Paper', totalMarks, durationMinutes: request.durationMinutes || 150, sections, difficultyDistribution: request.difficultyDistribution || { EASY: 0.2, MEDIUM: 0.5, HARD: 0.3 } };
  }

  private async loadCurriculum(request: AiExaminorRequest) {
    const subject = await this.prisma.subject.findFirst({ where: { id: request.subjectId, ...(request.schoolId ? { schoolId: request.schoolId } : {}) }, include: { Topic: { include: { competencies: true, learningOutcomes: true }, orderBy: { sortOrder: 'asc' } }, SyllabusEntry: { orderBy: [{ formNumber: 'asc' }, { sourcePage: 'asc' }] } } });
    const eocs = await this.prisma.elementOfConstruct.findMany({ where: { subjectId: request.subjectId, ...(request.includeEocs?.length ? { id: { in: request.includeEocs } } : {}) }, include: { competencies: true }, orderBy: { sortOrder: 'asc' } });
    const topics = (subject?.Topic || []).filter(topic => !request.includeTopics?.length || request.includeTopics.includes(topic.id));
    return { subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null, topics: topics.map(topic => ({ id: topic.id, name: topic.name, competencies: topic.competencies.map(c => ({ id: c.id, name: c.name, description: c.description, bloomLevel: c.bloomLevel })) })), eocs: eocs.map(eoc => ({ id: eoc.id, name: eoc.name, competencies: eoc.competencies.map(c => c.name) })), syllabusEntries: (subject?.SyllabusEntry || []).map(entry => ({ code: entry.competencyCode, topic: entry.topic, competency: entry.competency, standard: entry.expectedStandard, sourcePage: entry.sourcePage })) };
  }

  private buildFallback(blueprint: any, curriculum: any) {
    const evidence = curriculum.syllabusEntries[0] || curriculum.topics[0]?.competencies[0] || { competency: 'Curriculum competency', topic: 'General syllabus content', standard: '' };
    let number = 1;
    return { sections: blueprint.sections.map((section: AiExaminorSectionRequest) => ({ code: section.code, title: section.title, instructions: section.answerRule === 'ONE' ? 'Answer one item in this section.' : 'Answer all items in this section.', questions: Array.from({ length: section.itemCount }, (_, index) => { const marks = this.allocateMarks(section.totalMarks, section.itemCount, index); const questionNumber = number++; const types = section.questionTypes?.length ? section.questionTypes : ['STRUCTURED']; const type = types[index % types.length]; return { number: questionNumber, type, stem: `Using the syllabus content on ${evidence.topic || 'the selected topic'}, demonstrate the competency: ${evidence.competency || 'apply the relevant knowledge and skills'}.`, marks, difficulty: index === 0 ? 'EASY' : index === section.itemCount - 1 ? 'HARD' : 'MEDIUM', bloomLevel: 'APPLY', topic: evidence.topic || '', competency: evidence.competency || '', tasks: [{ label: '(a)', prompt: 'Show your working and give a clear final response.', marks }], traceability: [{ source: evidence.code ? `Syllabus competency ${evidence.code}` : 'Curriculum competency', evidence: evidence.standard || evidence.competency || '' }], markingKey: [{ task: '(a)', answer: 'A correct response demonstrating the stated competency.', markAllocation: [{ marks, criterion: 'Correct method, reasoning, and final response.' }], acceptableAlternatives: [] }] }; }) })) , metadata: { assumptions: ['Fallback wording is a draft and should be reviewed by a qualified subject examiner.'], qualityChecks: [] } };
  }

  private allocateMarks(total: number, count: number, index: number) { const base = Math.floor(total / count); return base + (index < total % count ? 1 : 0); }
  private parseJson(raw: string) { try { return JSON.parse(raw.replace(/^```json\s*|```$/g, '').trim()); } catch { throw new BadRequestException('AI-EXAMINOR returned invalid JSON'); } }

  private validateArtifact(artifact: any, blueprint: any, curriculum: any) {
    if (!artifact || !Array.isArray(artifact.sections) || artifact.sections.length !== blueprint.sections.length) throw new BadRequestException('Generated paper does not match its section blueprint');
    const questions = artifact.sections.flatMap((section: any, index: number) => { const expected = blueprint.sections[index]; if (!Array.isArray(section.questions) || section.questions.length !== expected.itemCount) throw new BadRequestException(`Section ${expected.code} has an invalid item count`); if (section.questions.reduce((sum: number, q: any) => sum + Number(q.marks || 0), 0) !== expected.totalMarks) throw new BadRequestException(`Section ${expected.code} marks do not match its blueprint`); return section.questions; });
    for (const question of questions) { if (!question.stem || !question.markingKey?.length || !question.tasks?.length) throw new BadRequestException('Every generated question requires tasks and a marking key'); const taskMarks = question.tasks.reduce((sum: number, task: any) => sum + Number(task.marks || 0), 0); const keyMarks = question.markingKey.reduce((sum: number, key: any) => sum + (key.markAllocation || []).reduce((inner: number, mark: any) => inner + Number(mark.marks || 0), 0), 0); if (taskMarks !== Number(question.marks) || keyMarks !== taskMarks) throw new BadRequestException('Question tasks and marking-key allocations must equal question marks'); }
    return { title: blueprint.title, subject: curriculum.subject, durationMinutes: blueprint.durationMinutes, totalMarks: blueprint.totalMarks, sections: artifact.sections, markingKey: questions.flatMap((question: any) => question.markingKey.map((key: any) => ({ questionNumber: question.number, ...key }))), metadata: { ...artifact.metadata, generatedBy: 'AI-EXAMINOR', aiEnriched: Boolean(this.openai), blueprint } };
  }
}
