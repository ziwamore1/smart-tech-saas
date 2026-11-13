import { BadRequestException } from '@nestjs/common';
import { AiExaminorService } from './ai-examinor.service';

describe('AiExaminorService', () => {
  const prisma = {
    subject: { findFirst: jest.fn() },
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
    expect(result.sections.flatMap((section: any) => section.questions).every((q: any) => q.tasks.every((task: any) => task.prompt !== q.stem))).toBe(true);
    expect(result.markingKey).toHaveLength(6);
    expect(result.metadata.generatedBy).toBe('AI-EXAMINOR');
  });

  it('rejects a blueprint whose section marks do not add up', async () => {
    const service = new AiExaminorService(prisma, config);
    await expect(service.generate({
      subjectId: 'subject-1', totalMarks: 100,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 90, itemCount: 1, answerRule: 'ALL' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
