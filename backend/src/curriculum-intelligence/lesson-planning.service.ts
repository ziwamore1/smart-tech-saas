import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';

const CBC_LESSON_PLAN_SYSTEM_PROMPT = `You are the SmartTech CBC Lesson Planning Specialist for Zambia's secondary curriculum.
Produce a professionally teachable lesson plan, never a generic outline. Use only the supplied syllabus evidence. Do not invent topic codes, competencies, expected standards, references, or curriculum activities. If an expected standard is absent from the source, state that it is not captured and phrase the planned evidence as a teacher-verifiable target.

The lesson must use this exact common preamble shape: teacher, date, form/class, time, subject, duration, topic, sub-topic, totalEnrol, boys, girls, resources, references, specificCompetences, expectedStandard, preRequisiteKnowledge, rationale.

Return JSON only with this shape:
{
  "title": "...",
  "preamble": { "teacher": "", "date": "", "form": "", "time": "", "subject": "", "duration": 0, "topic": "", "subTopic": "", "totalEnrol": 0, "boys": 0, "girls": 0, "resources": [], "references": [], "specificCompetences": [], "expectedStandard": "", "preRequisiteKnowledge": [], "rationale": "" },
  "learningObjectives": [],
  "subjectTable": { "title": "", "columns": [], "rows": [] },
  "activities": [ { "title": "", "stage": "INTRODUCTION|LESSON DEVELOPMENT|CONCLUSION", "teacherActivity": "", "learnerActivity": "", "methodology": [], "timeMinutes": 0, "task": "", "expectedSolution": "", "assessmentEvidence": "" } ],
  "assessment": { "questions": [ { "question": "", "expectedAnswer": "", "marks": 0 } ], "successCriteria": [] },
  "lessonEvaluation": { "teacher": { "criteria": [], "evidence": [], "ratingGuide": [] }, "pupil": { "criteria": [], "evidence": [], "ratingGuide": [] } },
  "homework": [ { "question": "", "expectedAnswer": "" } ],
  "differentiation": { "support": [], "extension": [], "inclusion": [] },
  "syllabusTraceability": [ { "code": "", "source": "", "alignment": "" } ]
}

Every activity must contain a concrete expectedSolution. For explanation, discussion, practical, or group activities, provide the expected learner response, observation, worked result, rubric, or decision criteria. Include expected answers for every assessment and homework item. Under lessonEvaluation.teacher, evaluate delivery, accuracy, questioning, classroom management, inclusion, pacing, and methodology using observable evidence; under lessonEvaluation.pupil, evaluate participation, collaboration, practical work, reasoning, communication, and achievement of the target using observable evidence. Do not combine these evaluations. Make activities appropriate to the supplied class level, subject, topic, sub-topic, competencies, and duration. Use a meaningful subjectTable: mathematics may use a staged teacher/pupil table, while sciences, languages, practical, and humanities may use their own useful columns. Do not use placeholder text, “students will understand”, or “teacher explains” without the actual content and answer/evidence.`;

@Injectable()
export class LessonPlanningService {
  private readonly logger = new Logger(LessonPlanningService.name);

  private readonly openai?: OpenAI;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) this.openai = new OpenAI({ apiKey });
  }

  async createLessonPlan(data: {
    title: string; subjectId: string; topicId?: string; subtopicId?: string;
    classId?: string; teacherId?: string; duration?: number; weekNumber?: number;
    termId?: string; academicYearId?: string; schoolId?: string;
  }) {
    return this.prisma.curriculumLessonPlan.create({
      data: { ...data, status: 'DRAFT', isGenerated: false },
      include: { activities: true },
    });
  }

  async generateFromCurriculum(data: {
    subjectId: string; topicId: string; subtopicId?: string; classId?: string; teacherId?: string;
    duration?: number; weekNumber?: number; termId?: string; academicYearId?: string; schoolId?: string;
    lessonDate?: string; instruction?: string; sourceLessonPlanId?: string;
  }) {
    if (!this.openai) {
      throw new ServiceUnavailableException('CBC lesson planning AI requires OPENAI_API_KEY');
    }

    const sourcePlan = data.sourceLessonPlanId
      ? await this.prisma.curriculumLessonPlan.findUnique({ where: { id: data.sourceLessonPlanId } })
      : null;
    if (data.sourceLessonPlanId && (!sourcePlan || (data.schoolId && sourcePlan.schoolId && sourcePlan.schoolId !== data.schoolId))) {
      throw new BadRequestException('Source lesson plan was not found for this school');
    }
    const subject = await this.prisma.subject.findUnique({ where: { id: data.subjectId } });
    const topic = await this.prisma.topic.findFirst({
      where: { id: data.topicId, subjectId: data.subjectId },
      include: { subtopics: true, competencies: true, learningOutcomes: true },
    });
    if (!subject || !topic) throw new BadRequestException('Subject and topic must belong to the same curriculum');

    const subtopic = data.subtopicId
      ? topic.subtopics.find(item => item.id === data.subtopicId)
      : undefined;
    if (data.subtopicId && !subtopic) throw new BadRequestException('Subtopic does not belong to the selected topic');

    const classRecord = data.classId
      ? await this.prisma.class.findUnique({ where: { id: data.classId }, include: { levelType: true } })
      : null;
    if (data.classId && (!classRecord || classRecord.schoolId !== data.schoolId)) {
      throw new BadRequestException('Class does not belong to the selected school');
    }
    const teacher = data.teacherId
      ? await this.prisma.teacher.findUnique({ where: { id: data.teacherId }, include: { user: { select: { firstName: true, lastName: true } } } })
      : null;
    const enrolments = data.classId
      ? await this.prisma.enrollment.findMany({
        where: { classId: data.classId, schoolId: data.schoolId, status: 'ACTIVE' },
        select: { student: { select: { gender: true } } },
      })
      : [];
    const boys = enrolments.filter(item => /^m(ale)?$/i.test(item.student.gender || '')).length;
    const girls = enrolments.filter(item => /^f(emale)?$/i.test(item.student.gender || '')).length;

    const syllabusEntries = await this.prisma.syllabusEntry.findMany({
      where: {
        subjectId: data.subjectId,
        topic: topic.name,
        ...(subtopic ? { subtopic: subtopic.name } : {}),
      },
      orderBy: [{ formNumber: 'asc' }, { unitCode: 'asc' }, { subUnitCode: 'asc' }],
    });
    const relevantCompetencies = topic.competencies.filter(item => !subtopic || item.subtopicId === subtopic.id);
    const relevantOutcomes = topic.learningOutcomes.filter(item => !subtopic || item.subtopicId === subtopic.id);
    const promptContext = {
      subject: { name: subject.name, code: subject.code },
      teacher: teacher ? { name: `${teacher.user.firstName} ${teacher.user.lastName}`.trim() } : null,
      class: classRecord ? { name: classRecord.name, level: classRecord.levelType.name } : null,
      enrollment: { total: enrolments.length, boys, girls },
      topic: { id: topic.id, code: topic.code, name: topic.name },
      subtopic: subtopic ? { id: subtopic.id, code: subtopic.code, name: subtopic.name } : null,
      competencies: relevantCompetencies.map(item => ({ id: item.id, code: item.code, name: item.name, bloomLevel: item.bloomLevel })),
      learningOutcomes: relevantOutcomes.map(item => ({ id: item.id, code: item.code, name: item.name, bloomLevel: item.bloomLevel })),
      syllabusEntries: syllabusEntries.map(item => ({
        form: item.formNumber, unitCode: item.unitCode, subUnitCode: item.subUnitCode,
        competencyCode: item.competencyCode, topic: item.topic, subtopic: item.subtopic,
        competency: item.competency, learningActivities: item.learningActivities,
        expectedStandard: item.expectedStandard, sourcePage: item.sourcePage,
      })),
    };
    const response = await this.openai.chat.completions.create({
      model: this.config.get<string>('OPENAI_LESSON_PLAN_MODEL') || 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CBC_LESSON_PLAN_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({
          request: data,
          curriculum: promptContext,
          reuse: sourcePlan ? {
            sourceLessonPlanId: sourcePlan.id,
            sourceVersion: sourcePlan.version,
            previousPlan: sourcePlan.planData,
            instruction: data.instruction || 'Reuse this lesson plan with the selected class and preserve its valid syllabus alignment.',
          } : null,
        }) },
      ],
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new ServiceUnavailableException('Lesson planning AI returned no content');
    const plan = this.parseAndValidatePlan(raw, promptContext, data.duration || 40);
    const lessonPlan = await this.prisma.curriculumLessonPlan.create({
      data: {
        title: plan.title,
        subjectId: data.subjectId,
        topicId: data.topicId,
        subtopicId: data.subtopicId,
        classId: data.classId,
        teacherId: data.teacherId,
        duration: data.duration || 40,
        weekNumber: data.weekNumber,
        termId: data.termId,
        academicYearId: data.academicYearId,
        schoolId: data.schoolId,
        status: 'DRAFT',
        isGenerated: true,
        version: sourcePlan ? sourcePlan.version + 1 : 1,
        generationInstruction: data.instruction,
        reusedFromId: sourcePlan?.id,
        objectives: JSON.stringify(plan.learningObjectives),
        materials: JSON.stringify(plan.resources),
        assessmentMethods: JSON.stringify({ assessment: plan.assessment, lessonEvaluation: plan.lessonEvaluation }),
        planData: plan,
        activities: {
          create: plan.activities.map((activity: any, index: number) => ({
            title: activity.title,
            description: JSON.stringify(activity),
            duration: activity.timeMinutes,
            activityType: activity.stage,
            sortOrder: index,
            schoolId: data.schoolId,
          })),
        },
      },
      include: { activities: { orderBy: { sortOrder: 'asc' } }, subject: true, topic: true, subtopic: true },
    });
    return lessonPlan;
  }

  private parseAndValidatePlan(raw: string, context: any, duration: number) {
    let plan: any;
    try { plan = JSON.parse(raw); } catch { throw new ServiceUnavailableException('Lesson planning AI returned invalid JSON'); }
    if (!plan.title || !Array.isArray(plan.activities) || plan.activities.length < 3) {
      throw new ServiceUnavailableException('Lesson planning AI returned an incomplete lesson plan');
    }
    if (plan.preamble?.subject !== context.subject.name || plan.preamble?.topic !== context.topic.name) {
      throw new ServiceUnavailableException('Lesson plan failed subject/topic alignment validation');
    }
    for (const activity of plan.activities) {
      if (!activity.title || !activity.stage || !activity.teacherActivity || !activity.learnerActivity || !activity.expectedSolution) {
        throw new ServiceUnavailableException('Every lesson activity must include activities and an expected solution/answer');
      }
    }
    const knownCodes = new Set([
      ...context.competencies.map((item: any) => item.code).filter(Boolean),
      ...context.syllabusEntries.flatMap((item: any) => [item.unitCode, item.subUnitCode, item.competencyCode]).filter(Boolean),
    ]);
    const references = Array.isArray(plan.syllabusTraceability) ? plan.syllabusTraceability : [];
    if (!references.length || references.some((item: any) => item.code && !knownCodes.has(item.code))) {
      throw new ServiceUnavailableException('Lesson plan is missing valid syllabus traceability');
    }
    const teacherEvaluation = plan.lessonEvaluation?.teacher;
    const pupilEvaluation = plan.lessonEvaluation?.pupil;
    if (!teacherEvaluation?.criteria?.length || !teacherEvaluation?.evidence?.length || !pupilEvaluation?.criteria?.length || !pupilEvaluation?.evidence?.length) {
      throw new ServiceUnavailableException('Lesson plan must contain separate teacher and pupil evaluations');
    }
    plan.preamble.totalEnrol = context.enrollment.total;
    plan.preamble.boys = context.enrollment.boys;
    plan.preamble.girls = context.enrollment.girls;
    plan.duration = duration;
    return plan;
  }

  async getLessonPlans(filters: { teacherId?: string; subjectId?: string; classId?: string }) {
    const where: any = {};
    if (filters.teacherId) where.teacherId = filters.teacherId;
    if (filters.subjectId) where.subjectId = filters.subjectId;
    if (filters.classId) where.classId = filters.classId;
    return this.prisma.curriculumLessonPlan.findMany({
      where,
      include: { activities: { orderBy: { sortOrder: 'asc' } }, subject: true, topic: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLessonPlanRevisions(id: string) {
    return this.prisma.curriculumLessonPlan.findMany({
      where: { OR: [{ id }, { reusedFromId: id }] },
      include: { subject: true, topic: true, subtopic: true },
      orderBy: [{ version: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getLessonPlan(id: string) {
    return this.prisma.curriculumLessonPlan.findUnique({
      where: { id },
      include: { activities: { orderBy: { sortOrder: 'asc' } }, subject: true, topic: true, subtopic: true },
    });
  }

  async updateLessonPlan(id: string, data: any) {
    return this.prisma.curriculumLessonPlan.update({ where: { id }, data, include: { activities: true } });
  }
}
