import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { ExaminationComposer } from '../exam-authoring/examination-composer';
import { renderDiagramSvg } from '../exam-authoring/exam-diagram-renderer';
import { normalizeBlueprintStructure } from '../exam-authoring/blueprint.types';

export interface AiExaminorSectionRequest {
  id?: string;
  code: string;
  title: string;
  instructions?: string;
  totalMarks: number;
  itemCount: number;
  answerRule: 'ALL' | 'ONE' | 'ANY';
  responseType?: string;
  taskPattern?: string;
  markingMethod?: string;
  candidateAnswerSpace?: string;
  questionTypes?: string[];
}

export interface AiExaminorRequest {
  schoolId?: string;
  subjectId: string;
  classId?: string;
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
When a task asks the candidate to draw, plot, sketch or construct a graph, diagram or scale drawing, the marking key for that task must include a machine-renderable "diagram" object, not a verbal description. Use one of these types: VENN_3_SET, CARTESIAN_GRAPH, SPEED_TIME_GRAPH, DISTANCE_TIME_GRAPH, HISTOGRAM, TRIANGLE_CONSTRUCTION, or SVG for a subject-specific labelled illustration. SVG must contain only static, self-contained drawing elements; never include scripts, event handlers, external resources or executable URLs.
Diagram fields: VENN_3_SET {labels:[3 labels], regionValues:{onlyA,onlyB,onlyC,onlyAB,onlyAC,onlyBC,abc,outside}}; CARTESIAN_GRAPH/SPEED_TIME_GRAPH/DISTANCE_TIME_GRAPH {xMin,xMax,yMin,yMax,xLabel,yLabel,lines:[{from:{x,y},to:{x,y},label,dashed}],segments:[{points:[{x,y}],label}],shadedRegion:[{x,y}],points:[{x,y,label,highlight}]}; HISTOGRAM {classes:[{label,frequency}],frequencyPolygon:true}; TRIANGLE_CONSTRUCTION {sideAB,sideAC,angleA,units,scaleLabel,showCircumcircle,showHeight,showConstructionArcs}; SVG {svg,title,caption}.
Return JSON only with: {"sections":[{"code":"","title":"","instructions":"","questions":[{"number":1,"type":"STRUCTURED","stem":"","marks":0,"difficulty":"MEDIUM","bloomLevel":"APPLY","topic":"","competency":"","tasks":[{"label":"(a)","prompt":"","marks":0}],"traceability":[{"source":"","evidence":""}],"markingKey":[{"task":"(a)","answer":"","markAllocation":[{"marks":1,"criterion":""}],"acceptableAlternatives":[],"diagram":{}}]}]}],"metadata":{"assumptions":[],"qualityChecks":[]}}
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

  async getCurriculumOptions(subjectId: string, classId: string, schoolId?: string) {
    const [subject, classRecord] = await Promise.all([
      this.prisma.subject.findFirst({
        where: { id: subjectId, ...(schoolId ? { schoolId } : {}) },
        select: { id: true, name: true, code: true },
      }),
      this.prisma.class.findFirst({
        where: { id: classId, ...(schoolId ? { schoolId } : {}) },
        include: { levelType: { select: { name: true } } },
      }),
    ]);
    if (!subject) throw new BadRequestException('Subject not found');
    if (!classRecord) throw new BadRequestException('Class not found');

    const formNumber = this.classFormNumber(classRecord.name, classRecord.levelType?.name);
    const entries = await this.prisma.syllabusEntry.findMany({
      where: { subjectId, ...(formNumber ? { formNumber } : {}) },
      orderBy: [{ formNumber: 'asc' }, { sourcePage: 'asc' }, { unitCode: 'asc' }],
    });
    const topics = new Map<string, any>();
    for (const entry of entries) {
      const topicName = this.cleanEvidenceText(entry.topic);
      const topic = topics.get(topicName) || {
        name: topicName,
        code: entry.unitCode,
        subtopics: new Map<string, any>(),
        competencies: [],
        expectedStandards: [],
      };
      if (entry.subtopic) {
        const subtopicName = this.cleanEvidenceText(entry.subtopic);
        const subtopic = topic.subtopics.get(subtopicName) || { name: subtopicName, code: entry.subUnitCode, competencies: [], expectedStandards: [] };
        if (entry.competency) subtopic.competencies.push({ code: entry.competencyCode, name: this.cleanEvidenceText(entry.competency) });
        if (entry.expectedStandard) subtopic.expectedStandards.push(this.cleanEvidenceText(entry.expectedStandard));
        topic.subtopics.set(subtopicName, subtopic);
      }
      if (entry.competency) topic.competencies.push({ code: entry.competencyCode, name: this.cleanEvidenceText(entry.competency) });
      if (entry.expectedStandard) topic.expectedStandards.push(this.cleanEvidenceText(entry.expectedStandard));
      topics.set(topicName, topic);
    }
    return {
      subject,
      class: { id: classRecord.id, name: classRecord.name, formNumber },
      topics: Array.from(topics.values()).map(topic => ({
        ...topic,
        subtopics: Array.from(topic.subtopics.values()),
        competencies: this.uniqueEvidence(topic.competencies),
        expectedStandards: [...new Set(topic.expectedStandards)],
      })),
      source: entries.length ? 'CBC syllabus entries' : 'No form-specific syllabus entries found',
    };
  }

  async generate(request: AiExaminorRequest, options: { requireProvider?: boolean } = {}) {
    if (options.requireProvider && !this.openai) throw new ServiceUnavailableException('AI-EXAMINOR generation requires a configured AI provider');
    const blueprint = this.normaliseBlueprint(request);
    const curriculum = await this.loadCurriculum(request);
    if (!curriculum.subject) throw new BadRequestException('Subject not found');
    if (!blueprint.topicPlan.length) {
      const selected = request.includeTopics?.length
        ? curriculum.topics.filter(topic => request.includeTopics!.some(value => value === topic.id || this.normalise(value) === this.normalise(topic.name)))
        : curriculum.topics;
      const topics = selected.length ? selected : curriculum.topics;
      if (topics.length) blueprint.topicPlan = topics.map(topic => ({ topic: topic.name, marks: blueprint.totalMarks / topics.length }));
    }
    blueprint.topicPlan = this.assignTopicQuestionCounts(blueprint.topicPlan, blueprint.sections);
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
           if (this.matchesBlueprintShape(candidate, blueprint) && this.isCandidateReady(candidate) && this.hasTopicCoverage(candidate, curriculum, blueprint)) artifact = candidate;
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
      sections: normalizeBlueprintStructure({ totalMarks, durationMinutes: request.durationMinutes || 150, sections }).sections,
      topicPlan: request.topicPlan || [],
      cognitiveDistribution: request.cognitiveDistribution || {},
      difficultyDistribution: request.difficultyDistribution || { EASY: 0.2, MEDIUM: 0.5, HARD: 0.3 },
    };
  }

  private async loadCurriculum(request: AiExaminorRequest) {
    const classRecord = request.classId
      ? await this.prisma.class.findFirst({ where: { id: request.classId, ...(request.schoolId ? { schoolId: request.schoolId } : {}) }, include: { levelType: { select: { name: true } } } })
      : null;
    const formNumber = classRecord ? this.classFormNumber(classRecord.name, classRecord.levelType?.name) : undefined;
    const subject = await this.prisma.subject.findFirst({
      where: { id: request.subjectId, ...(request.schoolId ? { schoolId: request.schoolId } : {}) },
      include: {
        Topic: { include: { competencies: true, learningOutcomes: true }, orderBy: { sortOrder: 'asc' } },
        SyllabusEntry: { where: formNumber ? { formNumber } : undefined, orderBy: [{ formNumber: 'asc' }, { sourcePage: 'asc' }] },
      },
    });
    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: { subjectId: request.subjectId, ...(request.includeEocs?.length ? { id: { in: request.includeEocs } } : {}) },
      include: { competencies: true },
      orderBy: { sortOrder: 'asc' },
    });
    const topicRecords = (subject?.Topic || []).map(topic => ({
      id: topic.id,
      name: this.cleanEvidenceText(topic.name),
      competencies: topic.competencies.map(c => ({ id: c.id, name: this.cleanEvidenceText(c.name), description: c.description, bloomLevel: c.bloomLevel })),
    }));
    const knownTopicNames = new Set(topicRecords.map(topic => this.normalise(topic.name)));
    const syllabusTopicRecords = (subject?.SyllabusEntry || []).reduce((records: any[], entry) => {
      const name = this.cleanEvidenceText(entry.topic);
      if (!name || knownTopicNames.has(this.normalise(name)) || records.some(topic => this.normalise(topic.name) === this.normalise(name))) return records;
      records.push({ id: `syllabus-${this.normalise(name).replace(/[^a-z0-9]+/g, '-')}`, name, competencies: [] });
      return records;
    }, []);
    const topics = [...topicRecords, ...syllabusTopicRecords].filter(topic => !request.includeTopics?.length || request.includeTopics.includes(topic.id) || request.includeTopics.some(value => this.normalise(value) === this.normalise(topic.name)));
    return {
      subject: subject ? { id: subject.id, name: subject.name, code: subject.code } : null,
      topics,
      eocs: eocs.map(eoc => ({ id: eoc.id, name: eoc.name, competencies: eoc.competencies.map(c => c.name) })),
      syllabusEntries: (subject?.SyllabusEntry || []).map(entry => ({ code: entry.competencyCode, topic: this.cleanEvidenceText(entry.topic), subtopic: entry.subtopic ? this.cleanEvidenceText(entry.subtopic) : undefined, competency: entry.competency ? this.cleanEvidenceText(entry.competency) : undefined, standard: entry.expectedStandard ? this.cleanEvidenceText(entry.expectedStandard) : undefined, sourcePage: entry.sourcePage, formNumber: entry.formNumber })),
      formNumber,
    };
  }

  private classFormNumber(...labels: Array<string | null | undefined>) {
    const match = labels.join(' ').match(/(?:form|grade|year|level)\s*([1-4])(?:\b|[a-z])/i);
    return match ? Number(match[1]) : undefined;
  }

  private uniqueEvidence(items: Array<{ code?: string | null; name: string }>) {
    return Array.from(new Map(items.map(item => [`${item.code || ''}:${item.name}`, item])).values());
  }

  private cleanEvidenceText(value: string | null | undefined) {
    return String(value || '').replace(/\s*(?:(?:[.·…]\s*){3,})\d+\s*$/, '').replace(/\s+/g, ' ').trim();
  }

  private buildFallback(blueprint: any, curriculum: any) {
    return this.composer.compose(blueprint, curriculum);
  }

  private assignTopicQuestionCounts(topicPlan: Array<{ topic: string; marks: number; questionCount?: number }>, sections: any[]) {
    const plan = topicPlan.filter(item => String(item.topic || '').trim() && Number(item.marks) > 0);
    if (!plan.length) return [];
    const slots = sections.reduce((sum, section) => sum + Number(section.itemCount || 0), 0);
    const counts = plan.map(() => 0);
    if (slots >= plan.length) plan.forEach((_, index) => { counts[index] = 1; });

    const remaining = slots - counts.reduce((sum, count) => sum + count, 0);
    const totalMarks = plan.reduce((sum, item) => sum + Number(item.marks), 0);
    for (let index = 0; index < Math.max(0, remaining); index += 1) {
      const target = plan.reduce((best, item, itemIndex) => {
        const desired = (slots * Number(item.marks)) / totalMarks;
        const score = desired - counts[itemIndex];
        return score > best.score ? { itemIndex, score } : best;
      }, { itemIndex: 0, score: Number.NEGATIVE_INFINITY });
      counts[target.itemIndex] += 1;
    }

    if (slots < plan.length) {
      counts.fill(0);
      for (let index = 0; index < slots; index += 1) counts[Math.floor((index * plan.length) / slots)] = 1;
    }
    return plan.map((item, index) => ({ ...item, questionCount: counts[index] }));
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
      if (this.isGenericScaffold(stem, tasks.map((task: any) => this.normalise(task.prompt)))) return false;
      const prompts = tasks.map((task: any) => this.normalise(task.prompt));
      if (new Set(prompts).size !== prompts.length) return false;
      if (prompts.some(prompt => prompt.length < 12 || prompt === stem || this.isPlaceholderPrompt(prompt))) return false;
      const taskMarks = tasks.reduce((sum: number, task: any) => sum + Number(task.marks || 0), 0);
      if (taskMarks !== Number(question.marks || 0)) return false;
      return this.markingKeyCoversTasks(question, tasks) && this.diagramsCoverTasks(question, tasks);
    });
  }

  private minimumTaskCount(question: any) {
    return Number(question.marks || 0) >= 10 ? 2 : 1;
  }

  private isPlaceholderPrompt(prompt: string) {
    return /using the syllabus content|demonstrate the competency|show your working and give a clear final response|show the method, calculations and justification needed to answer the question|state the answer and justify your conclusion/i.test(prompt);
  }

  private isGenericScaffold(stem: string, prompts: string[]) {
    const scaffoldMarkers = [
      'school improvement team',
      'community committee',
      'small enterprise',
      'public service team',
      'defensible recommendation',
      'key terms associated with',
      'information in the scenario',
      'communicate the final recommendation',
    ];
    const markerCount = scaffoldMarkers.filter(marker => stem.includes(marker) || prompts.some(prompt => prompt.includes(marker))).length;
    return markerCount >= 2;
  }

  private hasTopicCoverage(artifact: any, curriculum: any, blueprint: any) {
    const questions = artifact.sections.flatMap((section: any) => section.questions || []);
    const generated = questions.map((question: any) => this.normalise(question.topic));
    const selected = (blueprint.topicPlan?.length ? blueprint.topicPlan.filter((topic: any) => topic.questionCount !== 0) : curriculum.topics || []).map((topic: any) => this.normalise(topic.topic || topic.name || topic));
    if (selected.length <= 1) return true;
    return selected.slice(0, questions.length).every(topic => generated.some(value => value.includes(topic) || topic.includes(value)));
  }

  private markingKeyCoversTasks(question: any, tasks: any[]) {
    const keys = Array.isArray(question.markingKey) ? question.markingKey : [];
    if (!keys.length) return false;
    return tasks.every((task: any) => keys.some((key: any) => this.normalise(key.task) === this.normalise(task.label)));
  }

  private diagramsCoverTasks(question: any, tasks: any[]) {
    const keys = Array.isArray(question.markingKey) ? question.markingKey : [];
    return tasks.every((task: any) => {
      if (!this.requiresDiagram(task.prompt)) return true;
      const key = keys.find((item: any) => this.normalise(item.task) === this.normalise(task.label));
      return this.hasRenderableDiagram(key);
    });
  }

  private requiresDiagram(prompt: string) {
    const value = this.normalise(prompt);
    const drawing = /\b(draw|construct|plot|sketch|represent|illustrate)\b/.test(value);
    const diagram = /\b(venn|diagram|graph|histogram|frequency polygon|frequency curve|cartesian|feasible region|circumcircle|scale drawing|scale model|construction)\b/.test(value);
    return drawing && diagram;
  }

  private hasRenderableDiagram(key: any) {
    if (!key?.diagram || typeof key.diagram !== 'object') return false;
    try {
      const svg = renderDiagramSvg(key.diagram);
      return Boolean(svg && svg.includes('<svg'));
    } catch {
      return false;
    }
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
    const plannedTopics = (blueprint.topicPlan || []).filter((item: any) => item.questionCount !== 0).map((item: any) => this.normalise(item.topic)).filter(Boolean);
    const availableTopics = plannedTopics.length
      ? plannedTopics
      : curriculum.topics.map((topic: any) => this.normalise(topic.name));
    const generatedTopics = questions.map((question: any) => this.normalise(question.topic));
    const requiredTopics = availableTopics.slice(0, questions.length);
    if (requiredTopics.length > 1 && !requiredTopics.every(topic => generatedTopics.some(value => value.includes(topic) || topic.includes(value)))) {
      throw new BadRequestException('Generated paper does not distribute questions across the selected syllabus topics');
    }
    const stems = new Set<string>();
    for (const question of questions) {
      if (!question.stem || !question.markingKey?.length || !question.tasks?.length) throw new BadRequestException('Every generated question requires tasks and a marking key');
      const normalizedStem = this.normalise(question.stem);
      if (stems.has(normalizedStem)) throw new BadRequestException(`Duplicate question text detected for question ${question.number}`);
      stems.add(normalizedStem);
      const tasks = question.tasks;
      if (tasks.length < this.minimumTaskCount(question)) throw new BadRequestException(`Question ${question.number} needs more than one independently assessable task for its mark tariff`);
      const prompts = tasks.map((task: any) => this.normalise(task.prompt));
      if (this.isGenericScaffold(normalizedStem, prompts)) throw new BadRequestException(`Question ${question.number} uses the legacy generic examination scaffold`);
      if (new Set(prompts).size !== prompts.length) throw new BadRequestException(`Question ${question.number} contains duplicate task prompts`);
      if (tasks.some((task: any) => Number(task.marks || 0) <= 0)) throw new BadRequestException(`Question ${question.number} has a task with invalid marks`);
      const labels = tasks.filter((task: any) => String(task.label || '').trim()).map((task: any) => this.normalise(task.label));
      if (labels.length && new Set(labels).size !== labels.length) throw new BadRequestException(`Question ${question.number} contains duplicate task labels`);
      const taskMarks = tasks.reduce((sum: number, task: any) => sum + Number(task.marks || 0), 0);
      const keyMarks = question.markingKey.reduce((sum: number, key: any) => sum + (key.markAllocation || []).reduce((inner: number, mark: any) => inner + Number(mark.marks || 0), 0), 0);
      if (tasks.some((task: any) => this.normalise(task.prompt) === normalizedStem)) throw new BadRequestException(`Question ${question.number} repeats its parent text as a task`);
      if (!this.markingKeyCoversTasks(question, tasks)) throw new BadRequestException(`Question ${question.number} marking key does not cover every task`);
      if (!this.diagramsCoverTasks(question, tasks)) throw new BadRequestException(`Question ${question.number} is missing a required marking-key diagram`);
      if (taskMarks !== Number(question.marks) || keyMarks !== taskMarks) throw new BadRequestException(`Question ${question.number} marking allocations do not equal its marks`);
      question.markingKey = (question.markingKey || []).map((key: any) => {
        const diagramSvg = key.diagram ? renderDiagramSvg(key.diagram) : key.diagramSvg;
        if (key.diagram && !diagramSvg) throw new BadRequestException(`Question ${question.number} contains an invalid marking-key diagram`);
        return { ...key, diagramSvg };
      });
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
