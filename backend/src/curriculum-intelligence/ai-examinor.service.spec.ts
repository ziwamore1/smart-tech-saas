import { BadRequestException } from '@nestjs/common';
import { AiExaminorService } from './ai-examinor.service';

describe('AiExaminorService', () => {
  const prisma = {
    subject: { findFirst: jest.fn() },
    class: { findFirst: jest.fn() },
    syllabusEntry: { findMany: jest.fn() },
    elementOfConstruct: { findMany: jest.fn() },
  } as any;
  const config = { get: jest.fn().mockReturnValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.subject.findFirst.mockResolvedValue({
      id: 'subject-1', name: 'Mathematics', code: 'MATH', Topic: [], SyllabusEntry: [
        { competencyCode: 'M1', topic: 'Number', competency: 'Use numbers', expectedStandard: 'Accurate calculation', sourcePage: 1 },
      ],
    });
    prisma.elementOfConstruct.findMany.mockResolvedValue([]);
    prisma.class.findFirst.mockResolvedValue({ id: 'class-1', name: 'Form 2', levelType: { name: 'Secondary' } });
    prisma.syllabusEntry.findMany.mockResolvedValue([
      { topic: 'Cell Biology', unitCode: '2.1', subtopic: 'Cell structure', subUnitCode: '2.1.1', competency: 'Identify cell structures', competencyCode: '2.1.1.1', expectedStandard: 'Correctly identifies cell structures' },
    ]);
  });

  it('generates the ECZ-style 80/20 paper and a complete marking key', async () => {
    const service = new AiExaminorService(prisma, config);
    const result = await service.generate({ subjectId: 'subject-1' });

    expect(result.totalMarks).toBe(100);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].questions).toHaveLength(4);
    expect(result.sections[1].questions).toHaveLength(2);
    expect(result.sections[0].questions.reduce((sum: number, q: any) => sum + q.marks, 0)).toBe(80);
    expect(result.sections[1].questions.every((q: any) => q.marks === 20)).toBe(true);
    expect(result.sections.reduce((sum: number, section: any) => sum + (section.answerRule === 'ONE' ? section.questions[0].marks : section.questions.reduce((inner: number, q: any) => inner + q.marks, 0)), 0)).toBe(100);
    expect(result.sections.flatMap((section: any) => section.questions).every((q: any) => q.tasks.length >= 2 && q.tasks.every((task: any) => task.prompt !== q.stem))).toBe(true);
    expect(result.sections.flatMap((section: any) => section.questions).every((q: any) => q.tasks.reduce((sum: number, task: any) => sum + task.marks, 0) === q.marks)).toBe(true);
    expect(result.markingKey).toHaveLength(result.sections.flatMap((section: any) => section.questions).reduce((sum: number, q: any) => sum + q.tasks.length, 0));
    expect(result.metadata.generatedBy).toBe('AI-EXAMINOR');
  });

  it('rejects a blueprint whose section marks do not add up', async () => {
    const service = new AiExaminorService(prisma, config);
    await expect(service.generate({
      subjectId: 'subject-1', totalMarks: 100,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 90, itemCount: 1, answerRule: 'ALL' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns class-specific syllabus topics, subtopics, competencies and standards', async () => {
    const service = new AiExaminorService(prisma, config);
    const result = await service.getCurriculumOptions('subject-1', 'class-1', 'school-1');

    expect(result.class.formNumber).toBe(2);
    expect(result.topics[0].name).toBe('Cell Biology');
    expect(result.topics[0].subtopics[0].name).toBe('Cell structure');
    expect(result.topics[0].subtopics[0].competencies[0].name).toBe('Identify cell structures');
    expect(result.topics[0].expectedStandards).toContain('Correctly identifies cell structures');
    expect(prisma.syllabusEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { subjectId: 'subject-1', formNumber: 2 } }));
  });

  it('uses subject-aware fallback questions instead of the generic recommendation scaffold', async () => {
    prisma.subject.findFirst.mockResolvedValue({
      id: 'subject-1', name: 'Biology', code: '4012',
      Topic: ['Cell Biology', 'Nutrition', 'Ecology', 'Genetics', 'Reproduction', 'Health'].map((name, index) => ({ id: `topic-${index}`, name, competencies: [{ id: `competency-${index}`, name: `Explain ${name}` }] })),
      SyllabusEntry: [],
    });
    const service = new AiExaminorService(prisma, config);
    const result = await service.generate({ subjectId: 'subject-1' });
    const questions = result.sections.flatMap((section: any) => section.questions);

    expect(questions.every((question: any) => !question.stem.includes('defensible recommendation'))).toBe(true);
    expect(new Set(questions.map((question: any) => question.topic)).size).toBeGreaterThanOrEqual(5);
  });
});
