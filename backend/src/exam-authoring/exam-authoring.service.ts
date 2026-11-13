import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiGenerationStatus, DifficultyLevel, ExamAuthoringStatus, ExamAuditAction, ExamValidationSeverity, QuestionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBlueprintInput {
  name: string;
  description?: string;
  subjectId: string;
  academicStageId?: string;
  structure: {
    totalMarks: number;
    durationMinutes: number;
    sections: Array<{ code: string; title: string; totalMarks: number; itemCount: number; answerRule: 'ALL' | 'ONE' | 'ANY'; questionTypes?: string[] }>;
    topicPlan?: Array<{ topic: string; marks: number; questionCount?: number }>;
    cognitiveDistribution?: Record<string, number>;
    difficultyDistribution?: Record<string, number>;
  };
}

export interface CreateExamDraftInput {
  blueprintId: string;
  subjectId: string;
  classId: string;
  termId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  schoolId: string;
  createdById: string;
  generationJobId?: string;
  artifact: any;
}

@Injectable()
export class ExamAuthoringService {
  constructor(private readonly prisma: PrismaService) {}

  async createBlueprint(schoolId: string, createdById: string, input: CreateBlueprintInput) {
    const subject = await this.prisma.subject.findFirst({ where: { id: input.subjectId, schoolId }, select: { id: true } });
    if (!subject) throw new BadRequestException('Subject does not belong to this school');
    const findings = this.validateBlueprint(input.structure);
    if (findings.some(finding => finding.severity === ExamValidationSeverity.ERROR)) throw new BadRequestException({ message: 'Blueprint is invalid', findings });
    return this.prisma.examBlueprint.create({ data: { name: input.name, description: input.description, subjectId: input.subjectId, academicStageId: input.academicStageId, schoolId, createdById, structure: input.structure } });
  }

  async listBlueprints(schoolId: string, filters?: { subjectId?: string; status?: string }) {
    return this.prisma.examBlueprint.findMany({ where: { schoolId, ...(filters?.subjectId ? { subjectId: filters.subjectId } : {}), ...(filters?.status ? { status: filters.status } : {}) }, include: { subject: { select: { id: true, name: true, code: true } }, _count: { select: { exams: true, versions: true } } }, orderBy: { updatedAt: 'desc' } });
  }

  async getDashboard(schoolId: string) {
    const totalExams = await this.prisma.exam.count({ where: { schoolId } });
    const approvedExams = await this.prisma.exam.count({ where: { schoolId, authoringStatus: { in: [ExamAuthoringStatus.APPROVED, ExamAuthoringStatus.PUBLISHED] } } });
    const draftExams = await this.prisma.exam.count({ where: { schoolId, authoringStatus: { in: [ExamAuthoringStatus.DRAFT, ExamAuthoringStatus.GENERATED] } } });
    const moderationExams = await this.prisma.exam.count({ where: { schoolId, authoringStatus: ExamAuthoringStatus.MODERATION } });
    const rejectedExams = await this.prisma.exam.count({ where: { schoolId, authoringStatus: ExamAuthoringStatus.REJECTED } });
    const markingKeys = await this.prisma.examinationMarkingScheme.count({ where: { version: { schoolId } } });
    const questions = await this.prisma.questionBank.count({ where: { schoolId } });
    const subjects = await this.prisma.subject.count({ where: { schoolId } });
    const versions = await this.prisma.examinationVersion.count({ where: { schoolId } });
    const recentVersions = await this.prisma.examinationVersion.findMany({ where: { schoolId }, include: { exam: { select: { id: true, title: true, authoringStatus: true } } }, orderBy: { createdAt: 'desc' }, take: 8 });
    const outstandingFindings = await this.prisma.examinationValidationFinding.count({ where: { isResolved: false, severity: ExamValidationSeverity.ERROR, run: { version: { schoolId } } } });
    return { totals: { totalExams, approvedExams, draftExams, moderationExams, rejectedExams, markingKeys, questions, subjects, versions, outstandingFindings }, recentVersions };
  }

  async listExaminations(schoolId: string, filters: { search?: string; status?: ExamAuthoringStatus; subjectId?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const where: any = {
      schoolId,
      ...(filters.status ? { authoringStatus: filters.status } : {}),
      ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
      ...(filters.search ? { title: { contains: filters.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({ where, include: { subject: { select: { id: true, name: true, code: true } }, blueprint: { select: { id: true, name: true } }, versions: { orderBy: { version: 'desc' }, take: 1, select: { id: true, version: true, status: true, createdAt: true } }, _count: { select: { questions: true, versions: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.exam.count({ where }),
    ]);
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listVersions(schoolId: string, examId: string) {
    const exam = await this.prisma.exam.findFirst({ where: { id: examId, schoolId }, select: { id: true, title: true } });
    if (!exam) throw new NotFoundException('Examination not found');
    return this.prisma.examinationVersion.findMany({ where: { examId, schoolId }, include: { validationRuns: { orderBy: { startedAt: 'desc' }, take: 1, include: { findings: true } }, moderation: { orderBy: { createdAt: 'desc' } }, artifacts: true }, orderBy: { version: 'desc' } });
  }

  async getBlueprint(schoolId: string, id: string) {
    const blueprint = await this.prisma.examBlueprint.findFirst({ where: { id, schoolId }, include: { subject: { select: { id: true, name: true, code: true } } } });
    if (!blueprint) throw new NotFoundException('Examination blueprint not found');
    return blueprint;
  }

  async approveBlueprint(schoolId: string, id: string) {
    await this.getBlueprint(schoolId, id);
    return this.prisma.examBlueprint.update({ where: { id }, data: { isApproved: true, status: 'APPROVED' } });
  }

  validateBlueprint(structure: CreateBlueprintInput['structure']) {
    const findings: Array<{ severity: ExamValidationSeverity; code: string; message: string }> = [];
    if (!structure || structure.totalMarks <= 0 || structure.durationMinutes <= 0) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'BLUEPRINT_META_INVALID', message: 'Total marks and duration must be positive.' });
    if (!structure?.sections?.length) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'BLUEPRINT_SECTIONS_REQUIRED', message: 'At least one examination section is required.' });
    const sectionMarks = (structure?.sections || []).reduce((sum, section) => sum + Number(section.totalMarks || 0), 0);
    if (sectionMarks !== Number(structure?.totalMarks || 0)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'BLUEPRINT_MARK_TOTAL_MISMATCH', message: 'Section marks must equal total examination marks.' });
    for (const section of structure?.sections || []) {
      if (!section.code || !section.title || section.itemCount <= 0 || section.totalMarks <= 0) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'BLUEPRINT_SECTION_INVALID', message: `Section ${section.code || '(unnamed)'} has invalid metadata.` });
      if (section.answerRule === 'ONE' && section.itemCount < 2) findings.push({ severity: ExamValidationSeverity.WARNING, code: 'BLUEPRINT_OPTIONAL_COUNT', message: `Section ${section.code} allows one answer but contains fewer than two items.` });
      if (section.answerRule === 'ONE' && section.totalMarks <= 0) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'BLUEPRINT_OPTIONAL_MARKS_INVALID', message: `Section ${section.code} must define the marks awarded for the selected optional item.` });
    }
    const topicPlanMarks = (structure?.topicPlan || []).reduce((sum, item) => sum + Number(item.marks || 0), 0);
    if (structure?.topicPlan?.length && topicPlanMarks !== Number(structure.totalMarks || 0)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'BLUEPRINT_TOPIC_MARK_MISMATCH', message: 'Topic-plan marks must equal the advertised examination marks.' });
    return findings;
  }

  async createExamDraft(input: CreateExamDraftInput) {
    const blueprint = await this.prisma.examBlueprint.findFirst({ where: { id: input.blueprintId, schoolId: input.schoolId } });
    if (!blueprint) throw new NotFoundException('Approved examination blueprint not found');
    if (!blueprint.isApproved) throw new ForbiddenException('An approved blueprint is required before saving an examination');
    if (!input.artifact?.sections || input.artifact.totalMarks !== Number((blueprint.structure as any).totalMarks)) throw new BadRequestException('Generated artifact does not match the approved blueprint');
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const endsAt = input.endsAt ? new Date(input.endsAt) : new Date(startsAt.getTime() + Number(input.artifact.durationMinutes || 60) * 60_000);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('Exam start and end times are invalid');

    return this.prisma.$transaction(async tx => {
      const exam = await tx.exam.create({ data: { title: input.title, type: 'EXAM', classId: input.classId, subjectId: input.subjectId, termId: input.termId, schoolId: input.schoolId, blueprintId: blueprint.id, duration: input.artifact.durationMinutes, totalScore: input.artifact.totalMarks, startsAt, endsAt, createdById: input.createdById, authoringStatus: ExamAuthoringStatus.GENERATED, status: 'draft', instructions: 'Follow the instructions in each section. Show all necessary working.' } });
      const questionIds: Array<{ id: string; question: any }> = [];
      for (let sectionIndex = 0; sectionIndex < input.artifact.sections.length; sectionIndex++) {
        const section = input.artifact.sections[sectionIndex];
        const dbSection = await tx.examSection.create({ data: { examId: exam.id, title: section.title, instructions: section.instructions, type: section.questions.some((q: any) => q.type === 'ESSAY') ? 'ESSAY' : 'STRUCTURED', totalMarks: section.questions.reduce((sum: number, q: any) => sum + Number(q.marks), 0), order: sectionIndex } });
        for (let questionIndex = 0; questionIndex < section.questions.length; questionIndex++) {
          const question = section.questions[questionIndex];
          const dbQuestion = await tx.examQuestion.create({ data: { examId: exam.id, sectionId: dbSection.id, question: question.stem, questionType: this.questionType(question.type), options: question.options || undefined, score: Number(question.marks), difficulty: this.difficulty(question.difficulty), topic: question.topic || undefined, tags: ['AI-EXAMINOR'], metadata: { tasks: question.tasks, traceability: question.traceability, bloomLevel: question.bloomLevel, source: 'AI-EXAMINOR' }, order: questionIndex } });
          questionIds.push({ id: dbQuestion.id, question });
        }
      }
      const version = await tx.examinationVersion.create({ data: { examId: exam.id, blueprintId: blueprint.id, generationJobId: input.generationJobId, schoolId: input.schoolId, version: 1, status: ExamAuthoringStatus.GENERATED, snapshot: input.artifact, contentHash: createHash('sha256').update(JSON.stringify(input.artifact)).digest('hex'), createdById: input.createdById, markingScheme: { create: { status: 'DRAFT', entries: { create: questionIds.flatMap(item => (item.question.markingKey || []).map((key: any) => ({ questionId: item.id, taskLabel: key.task, expectedAnswer: key.answer || '', solution: key.solution, criteria: key.markAllocation || [], alternatives: key.acceptableAlternatives || [], marks: (key.markAllocation || []).reduce((sum: number, mark: any) => sum + Number(mark.marks || 0), 0) }))) } } } } });
      await tx.examinationAuditLog.create({ data: { versionId: version.id, schoolId: input.schoolId, userId: input.createdById, action: ExamAuditAction.GENERATED, details: { blueprintId: blueprint.id, questionCount: questionIds.length } } });
      return tx.exam.findUnique({ where: { id: exam.id }, include: { sections: { include: { questions: true }, orderBy: { order: 'asc' } }, versions: { include: { markingScheme: { include: { entries: true } } } } } });
    }, { maxWait: 10000, timeout: 30000 });
  }

  async startGenerationJob(schoolId: string, userId: string, input: any) {
    return this.prisma.aiGenerationJob.create({ data: { schoolId, subjectId: input.subjectId, blueprintId: input.blueprintId, requestedById: userId, provider: 'openai', model: input.model, status: AiGenerationStatus.RUNNING, request: input, startedAt: new Date() } });
  }

  async finishGenerationJob(id: string, response?: any, error?: string) {
    return this.prisma.aiGenerationJob.update({ where: { id }, data: { status: error ? AiGenerationStatus.FAILED : AiGenerationStatus.COMPLETED, response: response || undefined, error, completedAt: new Date() } });
  }

  async getVersion(schoolId: string, versionId: string) {
    const version = await this.prisma.examinationVersion.findFirst({ where: { id: versionId, schoolId }, include: { exam: true, markingScheme: { include: { entries: true } }, validationRuns: { include: { findings: true }, orderBy: { startedAt: 'desc' } }, moderation: { orderBy: { createdAt: 'desc' } }, artifacts: true } });
    if (!version) throw new NotFoundException('Examination version not found');
    return version;
  }

  async duplicateVersion(schoolId: string, versionId: string, userId: string, restore = false) {
    const source = await this.prisma.examinationVersion.findFirst({ where: { id: versionId, schoolId }, include: { exam: { include: { sections: { include: { questions: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } } }, markingScheme: { include: { entries: true } } } });
    if (!source) throw new NotFoundException('Examination version not found');
    return this.prisma.$transaction(async tx => {
      const clonedExam = await tx.exam.create({ data: { title: `${source.exam.title} ${restore ? `restored from v${source.version}` : 'copy'}`, description: source.exam.description, type: source.exam.type, classId: source.exam.classId, subjectId: source.exam.subjectId, termId: source.exam.termId, schoolId, blueprintId: source.exam.blueprintId, duration: source.exam.duration, totalScore: source.exam.totalScore, passingScore: source.exam.passingScore, instructions: source.exam.instructions, shuffleQuestions: source.exam.shuffleQuestions, showResults: source.exam.showResults, maxAttempts: source.exam.maxAttempts, allowReview: source.exam.allowReview, randomizeOrder: source.exam.randomizeOrder, autoGrade: source.exam.autoGrade, startsAt: source.exam.startsAt, endsAt: source.exam.endsAt, createdById: userId, authoringStatus: ExamAuthoringStatus.DRAFT, status: 'draft' } });
      const questionMap = new Map<string, string>();
      for (const section of source.exam.sections) {
        const clonedSection = await tx.examSection.create({ data: { examId: clonedExam.id, title: section.title, description: section.description, instructions: section.instructions, type: section.type, totalMarks: section.totalMarks, order: section.order, shuffleQuestions: section.shuffleQuestions } });
        for (const question of section.questions) {
          const clonedQuestion = await tx.examQuestion.create({ data: { examId: clonedExam.id, sectionId: clonedSection.id, question: question.question, questionType: question.questionType, options: question.options ?? undefined, correctAnswer: question.correctAnswer, explanation: question.explanation, score: question.score, difficulty: question.difficulty, competencyId: question.competencyId, topic: question.topic, tags: question.tags, partialScoring: question.partialScoring, negativeMarking: question.negativeMarking, order: question.order, attachmentUrl: question.attachmentUrl, metadata: question.metadata ?? undefined } });
          questionMap.set(question.id, clonedQuestion.id);
        }
      }
      const nextVersion = await tx.examinationVersion.create({ data: { examId: clonedExam.id, blueprintId: source.blueprintId, schoolId, version: 1, status: ExamAuthoringStatus.DRAFT, snapshot: source.snapshot, changeSummary: restore ? `Restored from examination version ${source.version}` : `Copied from examination version ${source.version}`, createdById: userId, markingScheme: source.markingScheme ? { create: { schemeVersion: source.markingScheme.schemeVersion, status: 'REVIEW_REQUIRED', instructions: source.markingScheme.instructions, entries: { create: source.markingScheme.entries.map(entry => ({ questionId: questionMap.get(entry.questionId) || Array.from(questionMap.values())[0], taskLabel: entry.taskLabel, expectedAnswer: entry.expectedAnswer, solution: entry.solution, criteria: entry.criteria, alternatives: entry.alternatives, commonErrors: entry.commonErrors, specialInstructions: entry.specialInstructions, marks: entry.marks })) } } } : undefined } });
      await tx.examinationAuditLog.create({ data: { versionId: nextVersion.id, schoolId, userId, action: restore ? ExamAuditAction.VERSION_CREATED : ExamAuditAction.DUPLICATED, details: { sourceVersionId: source.id, sourceVersion: source.version } } });
      return tx.exam.findUnique({ where: { id: clonedExam.id }, include: { sections: { include: { questions: true }, orderBy: { order: 'asc' } }, versions: { include: { markingScheme: { include: { entries: true } } } } } });
    });
  }

  async updateQuestion(schoolId: string, questionId: string, userId: string, data: { question?: string; score?: number; metadata?: any }) {
    const question = await this.prisma.examQuestion.findUnique({ where: { id: questionId }, include: { exam: true } });
    if (!question || question.exam.schoolId !== schoolId) throw new NotFoundException('Question not found');
    const version = await this.prisma.examinationVersion.findFirst({ where: { examId: question.examId, schoolId, status: { notIn: [ExamAuthoringStatus.APPROVED, ExamAuthoringStatus.PUBLISHED] } }, orderBy: { version: 'desc' }, include: { markingScheme: true } });
    if (!version) throw new ForbiddenException('Approved examination versions are immutable. Create a working copy before editing.');
    const snapshot: any = JSON.parse(JSON.stringify(version.snapshot));
    const snapshotQuestion = (snapshot.sections || []).flatMap((section: any) => section.questions || []).find((item: any) => Number(item.number) === question.order + 1 || item.id === question.id);
    if (snapshotQuestion) { if (data.question !== undefined) snapshotQuestion.stem = data.question; if (data.score !== undefined) snapshotQuestion.marks = data.score; if (data.metadata !== undefined) snapshotQuestion.metadata = data.metadata; }
    return this.prisma.$transaction(async tx => {
      const updated = await tx.examQuestion.update({ where: { id: questionId }, data: { question: data.question, score: data.score, metadata: data.metadata } });
      await tx.examinationVersion.update({ where: { id: version.id }, data: { snapshot, status: ExamAuthoringStatus.DRAFT, changeSummary: `Question ${question.order + 1} edited; marking key requires review.` } });
      if (version.markingScheme) await tx.examinationMarkingScheme.update({ where: { id: version.markingScheme.id }, data: { status: 'REVIEW_REQUIRED', schemeVersion: { increment: 1 } } });
      await tx.examinationAuditLog.create({ data: { versionId: version.id, schoolId, userId, action: ExamAuditAction.QUESTION_UPDATED, details: { questionId, markingKeyReviewRequired: true } } });
      return updated;
    });
  }

  async replaceGeneratedQuestion(schoolId: string, versionId: string, questionNumber: number, userId: string, question: any) {
    const version = await this.getVersion(schoolId, versionId);
    if ([ExamAuthoringStatus.APPROVED, ExamAuthoringStatus.PUBLISHED].includes(version.status)) throw new ForbiddenException('Approved examination versions are immutable. Create a working copy before regenerating a question.');
    const snapshot: any = JSON.parse(JSON.stringify(version.snapshot));
    const snapshotQuestion = (snapshot.sections || []).flatMap((section: any) => section.questions || []).find((item: any) => Number(item.number) === Number(questionNumber));
    if (!snapshotQuestion) throw new NotFoundException(`Question ${questionNumber} was not found in this version`);
    const dbQuestion = (version.exam?.sections || []).flatMap((section: any) => section.questions || []).find((item: any) => Number(item.order) + 1 === Number(questionNumber));
    if (!dbQuestion) throw new NotFoundException(`Stored question ${questionNumber} was not found`);
    snapshotQuestion.stem = question.stem; snapshotQuestion.tasks = question.tasks; snapshotQuestion.markingKey = question.markingKey; snapshotQuestion.topic = question.topic; snapshotQuestion.competency = question.competency; snapshotQuestion.bloomLevel = question.bloomLevel; snapshotQuestion.difficulty = question.difficulty;
    return this.prisma.$transaction(async tx => {
      await tx.examQuestion.update({ where: { id: dbQuestion.id }, data: { question: question.stem, score: Number(question.marks), difficulty: this.difficulty(question.difficulty), topic: question.topic || undefined, metadata: { tasks: question.tasks, traceability: question.traceability, bloomLevel: question.bloomLevel, source: 'AI-EXAMINOR regeneration' } } });
      await tx.examinationMarkingEntry.deleteMany({ where: { questionId: dbQuestion.id } });
      const scheme = await tx.examinationMarkingScheme.findUnique({ where: { versionId } });
      if (scheme) await tx.examinationMarkingEntry.createMany({ data: (question.markingKey || []).map((key: any) => ({ schemeId: scheme.id, questionId: dbQuestion.id, taskLabel: key.task, expectedAnswer: key.answer || '', solution: key.solution, criteria: key.markAllocation || [], alternatives: key.acceptableAlternatives || [], marks: (key.markAllocation || []).reduce((sum: number, mark: any) => sum + Number(mark.marks || 0), 0) })) });
      await tx.examinationVersion.update({ where: { id: versionId }, data: { snapshot, status: ExamAuthoringStatus.DRAFT, changeSummary: `Question ${questionNumber} regenerated; validation required.` } });
      await tx.examinationMarkingScheme.updateMany({ where: { versionId }, data: { status: 'REVIEW_REQUIRED', schemeVersion: { increment: 1 } } });
      await tx.examinationAuditLog.create({ data: { versionId, schoolId, userId, action: ExamAuditAction.QUESTION_UPDATED, details: { questionNumber, action: 'REGENERATED' } } });
      return tx.examinationVersion.findUnique({ where: { id: versionId }, include: { markingScheme: { include: { entries: true } } } });
    }, { maxWait: 10000, timeout: 30000 });
  }

  async updateMarkingEntry(schoolId: string, entryId: string, userId: string, data: { expectedAnswer?: string; solution?: string; criteria?: any; alternatives?: any; commonErrors?: any; specialInstructions?: string; marks?: number }) {
    const entry = await this.prisma.examinationMarkingEntry.findUnique({ where: { id: entryId }, include: { scheme: { include: { version: true } } } });
    if (!entry || entry.scheme.version.schoolId !== schoolId) throw new NotFoundException('Marking-key entry not found');
    if ([ExamAuthoringStatus.APPROVED, ExamAuthoringStatus.PUBLISHED].includes(entry.scheme.version.status)) throw new ForbiddenException('Approved marking schemes are immutable. Create a working copy before editing.');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.examinationMarkingEntry.update({ where: { id: entryId }, data });
      await tx.examinationMarkingScheme.update({ where: { id: entry.schemeId }, data: { status: 'DRAFT', schemeVersion: { increment: 1 } } });
      await tx.examinationAuditLog.create({ data: { versionId: entry.scheme.versionId, schoolId, userId, action: ExamAuditAction.MARKING_KEY_UPDATED, details: { entryId } } });
      return updated;
    });
  }

  async validateVersion(schoolId: string, versionId: string, userId: string) {
    const version = await this.getVersion(schoolId, versionId);
    const findings: Array<{ severity: ExamValidationSeverity; code: string; message: string; location?: string; suggestion?: string }> = [];
    const snapshot = version.snapshot as any;
    const blueprint = version.exam?.blueprintId ? await this.prisma.examBlueprint.findFirst({ where: { id: version.exam.blueprintId, schoolId } }) : null;
    const blueprintStructure = blueprint?.structure as any;
    const expectedTotal = Number(blueprintStructure?.totalMarks ?? snapshot?.totalMarks ?? 0);
    const blueprintSections = blueprintStructure?.sections || [];
    const actualTotal = (snapshot?.sections || []).reduce((sum: number, section: any, index: number) => { const sectionMarks = (section.questions || []).reduce((sectionSum: number, question: any) => sectionSum + Number(question.marks || 0), 0); return sum + (blueprintSections[index]?.answerRule === 'ONE' ? Number(section.questions?.[0]?.marks || 0) : sectionMarks); }, 0);
    if (actualTotal !== expectedTotal) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'MARK_TOTAL_MISMATCH', message: `Question marks total ${actualTotal}; expected ${expectedTotal}.`, suggestion: 'Rebalance question or task marks before moderation.' });
    if (!snapshot?.sections?.length) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'SECTIONS_MISSING', message: 'The examination has no sections.' });
    const seenStems = new Map<string, number>();
    if (blueprintSections.length && snapshot?.sections?.length !== blueprintSections.length) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'SECTION_COUNT_DRIFT', message: 'Generated sections do not match the approved blueprint.' });
    for (let sectionIndex = 0; sectionIndex < (snapshot?.sections || []).length; sectionIndex++) {
      const section = snapshot.sections[sectionIndex];
      const blueprintSection = blueprintSections[sectionIndex];
      if (blueprintSection) {
        const sectionMarks = (section.questions || []).reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);
        const candidateSectionMarks = blueprintSection.answerRule === 'ONE' ? Number((section.questions || [])[0]?.marks || 0) : sectionMarks;
        if (candidateSectionMarks !== Number(blueprintSection.totalMarks)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'SECTION_MARK_DRIFT', message: `Section ${blueprintSection.code} contributes ${candidateSectionMarks} candidate marks; expected ${blueprintSection.totalMarks}.`, location: `section:${blueprintSection.code}` });
        if (blueprintSection.answerRule === 'ONE' && (section.questions || []).some((question: any) => Number(question.marks || 0) !== Number(blueprintSection.totalMarks))) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'OPTIONAL_ITEM_MARK_DRIFT', message: `Every optional item in Section ${blueprintSection.code} must be worth ${blueprintSection.totalMarks} marks.`, location: `section:${blueprintSection.code}` });
        if ((section.questions || []).length !== Number(blueprintSection.itemCount)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'SECTION_ITEM_COUNT_DRIFT', message: `Section ${blueprintSection.code} has an unexpected number of items.`, location: `section:${blueprintSection.code}` });
        const requiredInstruction = blueprintSection.answerRule === 'ONE' ? 'one' : blueprintSection.answerRule === 'ANY' ? 'required' : 'all';
        if (!String(section.instructions || '').toLowerCase().includes(requiredInstruction)) findings.push({ severity: ExamValidationSeverity.WARNING, code: 'SECTION_INSTRUCTION_DRIFT', message: `Section ${blueprintSection.code} instructions may not reflect the ${blueprintSection.answerRule} answer rule.`, location: `section:${blueprintSection.code}`, suggestion: `State clearly whether candidates must answer ${requiredInstruction} items.` });
      }
    }
    for (const section of snapshot?.sections || []) {
      for (const question of section.questions || []) {
        const normalizedStem = String(question.stem || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (normalizedStem) {
          const previous = seenStems.get(normalizedStem);
          if (previous) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'DUPLICATE_QUESTION_STEM', message: `Question ${question.number} duplicates question ${previous}.`, location: `question:${question.number}`, suggestion: 'Regenerate the affected question before approval.' });
          else seenStems.set(normalizedStem, Number(question.number));
        }
        const taskMarks = (question.tasks || []).reduce((sum: number, task: any) => sum + Number(task.marks || 0), 0);
        const keyMarks = (question.markingKey || []).reduce((sum: number, key: any) => sum + (key.markAllocation || []).reduce((inner: number, mark: any) => inner + Number(mark.marks || 0), 0), 0);
        if (taskMarks !== Number(question.marks)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'TASK_MARK_MISMATCH', message: `Question ${question.number} task marks do not equal its total.`, location: `question:${question.number}` });
        if (keyMarks !== Number(question.marks)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'MARKING_KEY_MISMATCH', message: `Question ${question.number} marking-key marks do not equal its total.`, location: `question:${question.number}` });
        if (!question.stem || !question.markingKey?.length) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'QUESTION_INCOMPLETE', message: `Question ${question.number} is missing content or a marking key.`, location: `question:${question.number}` });
        for (const task of question.tasks || []) if (String(task.prompt || '').trim().toLowerCase() === normalizedStem) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'PARENT_TASK_DUPLICATION', message: `Question ${question.number} repeats its parent text as a task.`, location: `question:${question.number}.${task.label || 'task'}`, suggestion: 'Replace the repeated task with an independently assessable instruction.' });
      }
    }
    const topicPlan = blueprintStructure?.topicPlan || [];
    if (topicPlan.length) {
      const questions = (snapshot?.sections || []).flatMap((section: any) => section.questions || []);
      for (const target of topicPlan) {
        const coveredMarks = questions.filter((question: any) => String(question.topic || '').toLowerCase().includes(String(target.topic).toLowerCase())).reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);
        if (coveredMarks < Number(target.marks)) findings.push({ severity: ExamValidationSeverity.ERROR, code: 'TOPIC_COVERAGE_GAP', message: `Topic ${target.topic} has ${coveredMarks} mapped marks; expected ${target.marks}.`, location: `topic:${target.topic}`, suggestion: 'Regenerate or edit a question mapped to this approved topic.' });
      }
    }
    if (!blueprint) findings.push({ severity: ExamValidationSeverity.WARNING, code: 'BLUEPRINT_NOT_FOUND', message: 'The version has no accessible blueprint snapshot.', suggestion: 'Attach an approved blueprint before moderation.' });
    const hasErrors = findings.some(finding => finding.severity === ExamValidationSeverity.ERROR);
    const status = hasErrors ? ExamAuthoringStatus.REJECTED : findings.length ? ExamAuthoringStatus.PASSED_WITH_WARNINGS : ExamAuthoringStatus.PASSED;
    const quality = this.buildQualityReport(snapshot, blueprintStructure, findings);
    return this.prisma.$transaction(async tx => {
      const run = await tx.examinationValidationRun.create({ data: { versionId, status: hasErrors ? 'FAILED' : findings.length ? 'PASSED_WITH_WARNINGS' : 'PASSED', validatorVersion: 'ai-examinor-2', summary: { findingCount: findings.length, errorCount: findings.filter(f => f.severity === ExamValidationSeverity.ERROR).length, quality }, completedAt: new Date(), findings: { create: findings } }, include: { findings: true } });
      await tx.examinationVersion.update({ where: { id: versionId }, data: { status } });
      await tx.exam.update({ where: { id: version.examId }, data: { authoringStatus: status } });
      await tx.examinationAuditLog.create({ data: { versionId, schoolId, userId, action: ExamAuditAction.VALIDATION_COMPLETED, details: { validationRunId: run.id, status, findingCount: findings.length } } });
      return run;
    });
  }

  buildQualityReport(snapshot: any, blueprint: any, findings: Array<{ severity: ExamValidationSeverity }> = []) {
    const questions = (snapshot?.sections || []).flatMap((section: any) => section.questions || []);
    const topicCount = new Set(questions.map((question: any) => question.topic).filter(Boolean)).size;
    const demandCount = new Set(questions.map((question: any) => question.bloomLevel || question.difficulty).filter(Boolean)).size;
    const dimensions = {
      structuralIntegrity: questions.length && (snapshot?.sections || []).length === (blueprint?.sections || snapshot?.sections || []).length ? 20 : 0,
      markAllocation: findings.some(finding => String(finding.severity) === ExamValidationSeverity.ERROR) ? 0 : 20,
      topicCoverage: Math.min(15, topicCount * 5),
      assessmentDepth: Math.min(15, demandCount * 5),
      markingScheme: questions.length && questions.every((question: any) => question.markingKey?.length) ? 20 : 0,
      presentation: snapshot?.title && snapshot?.durationMinutes ? 10 : 0,
    };
    const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
    return { score, maximum: 100, dimensions, status: findings.some(finding => String(finding.severity) === ExamValidationSeverity.ERROR) ? 'NOT_READY' : score >= 80 ? 'READY' : 'REVIEW_REQUIRED', criticalFailure: findings.some(finding => String(finding.severity) === ExamValidationSeverity.ERROR) };
  }

  async submitForModeration(schoolId: string, versionId: string, userId: string) {
    const version = await this.getVersion(schoolId, versionId);
    const latestRun = version.validationRuns[0];
    if (!latestRun || latestRun.findings.some(finding => finding.severity === ExamValidationSeverity.ERROR && !finding.isResolved)) throw new BadRequestException('The examination must pass validation before moderation');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.examinationVersion.update({ where: { id: versionId }, data: { status: ExamAuthoringStatus.MODERATION } });
      await tx.exam.update({ where: { id: version.examId }, data: { authoringStatus: ExamAuthoringStatus.MODERATION } });
      await tx.examinationAuditLog.create({ data: { versionId, schoolId, userId, action: ExamAuditAction.SUBMITTED_FOR_MODERATION } });
      return updated;
    });
  }

  async moderate(schoolId: string, versionId: string, reviewerId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
    const version = await this.getVersion(schoolId, versionId);
    if (version.status !== ExamAuthoringStatus.MODERATION) throw new BadRequestException('Only examinations awaiting moderation can be decided');
    const status = decision === 'APPROVED' ? ExamAuthoringStatus.APPROVED : ExamAuthoringStatus.REJECTED;
    return this.prisma.$transaction(async tx => {
      const updated = await tx.examinationVersion.update({ where: { id: versionId }, data: { status, approvedById: decision === 'APPROVED' ? reviewerId : undefined, approvedAt: decision === 'APPROVED' ? new Date() : undefined } });
      await tx.examinationModerationRecord.create({ data: { versionId, reviewerId, decision, comments } });
      await tx.exam.update({ where: { id: version.examId }, data: { authoringStatus: status } });
      await tx.examinationAuditLog.create({ data: { versionId, schoolId, userId: reviewerId, action: decision === 'APPROVED' ? ExamAuditAction.APPROVED : ExamAuditAction.REJECTED, details: { comments } } });
      return updated;
    });
  }

  private questionType(type: string): QuestionType { return Object.values(QuestionType).includes(type as QuestionType) ? type as QuestionType : QuestionType.STRUCTURED; }
  private difficulty(value: string): DifficultyLevel { return Object.values(DifficultyLevel).includes(value as DifficultyLevel) ? value as DifficultyLevel : DifficultyLevel.MEDIUM; }
}
