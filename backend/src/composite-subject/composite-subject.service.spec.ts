import { CompositeSubjectService, isSeniorSecondaryClass } from './composite-subject.service';

const scienceComposite = {
  id: 'science-1',
  name: 'Science',
  code: 'SCI',
  curriculumId: 'cur-1',
  schoolId: null,
  isActive: true,
  calculationMethod: 'WEIGHTED_AVERAGE',
  components: [
    { id: 'c1', compositeSubjectId: 'science-1', subjectId: 'sub-physics', weight: 1, subject: { id: 'sub-physics', name: 'Physics', code: '5124' } },
    { id: 'c2', compositeSubjectId: 'science-1', subjectId: 'sub-chemistry', weight: 1, subject: { id: 'sub-chemistry', name: 'Chemistry', code: '5124' } },
  ],
};

const languageComposite = {
  id: 'language-1',
  name: 'English Language',
  code: 'EL',
  curriculumId: 'cur-1',
  schoolId: 'school-1',
  isActive: true,
  calculationMethod: 'WEIGHTED_AVERAGE',
  components: [
    { id: 'c3', compositeSubjectId: 'language-1', subjectId: 'sub-eng', weight: 2, subject: { id: 'sub-eng', name: 'English', code: 'ENG' } },
    { id: 'c4', compositeSubjectId: 'language-1', subjectId: 'sub-lit', weight: 1, subject: { id: 'sub-lit', name: 'Literature', code: 'LIT' } },
  ],
};

interface ComputedRow { subject: { name: string }; finalPercentage: number | null }

function makeFakePrisma(options: {
  klassLevel?: string | null;
  klassName?: string;
  composites?: { linked?: any[]; scoped?: any[]; matched?: any[] };
  taught?: string[];
  computed?: Record<string, ComputedRow | null>;
}) {
  const klass = {
    id: 'class-1',
    name: options.klassName ?? 'Grade 10C',
    levelType: options.klassLevel ? { name: options.klassLevel } : null,
  };
  const route = (where: any) => {
    if (where?.curriculum && where?.curriculum?.schoolCurricula) return options.composites?.linked ?? [];
    if (where?.OR) return options.composites?.scoped ?? [];
    if (where?.components && where?.components?.some) {
      const allowed = new Set<string>(where.components.every.subjectId.in ?? []);
      return (options.composites?.matched ?? [])
        .filter((c) => c.components.length > 0 && c.components.every((cc: any) => allowed.has(cc.subjectId)));
    }
    return [];
  };
  return {
    class: {
      findUnique: ({ include }: any) =>
        include?.levelType ? klass : { ...klass, gradingSystem: null, levelType: null },
    },
    teachingAssignment: {
      findMany: () => (options.taught ?? []).map((subjectId) => ({ subjectId })),
    },
    compositeSubject: {
      findMany: async ({ where }: any) => route(where),
      findUnique: async ({ where }: any) =>
        [...(options.composites?.linked ?? []), ...(options.composites?.scoped ?? []), ...(options.composites?.matched ?? [])]
          .find((c) => c.id === where.id) ?? null,
    },
    computedResult: {
      findUnique: async ({ where }: any) => options.computed?.[where.studentId_subjectId_termId.subjectId] ?? null,
    },
    gradingSystem: { findFirst: async () => null },
  };
}

describe('isSeniorSecondaryClass', () => {
  it('accepts Grade 10-12 class/levelType labels', () => {
    expect(isSeniorSecondaryClass({ name: 'Grade 10C', levelType: { name: 'Grade 10' } })).toBe(true);
    expect(isSeniorSecondaryClass({ name: 'Grade 12B', levelType: null })).toBe(true);
    expect(isSeniorSecondaryClass({ name: '10A', levelType: null })).toBe(true);
    expect(isSeniorSecondaryClass({ name: 'Senior A', levelType: { name: 'Senior Secondary' } })).toBe(true);
    expect(isSeniorSecondaryClass({ name: 'Form 3', levelType: { name: 'Senior 1' } })).toBe(true);
  });

  it('rejects junior classes (Forms 1-4) and unknowns', () => {
    expect(isSeniorSecondaryClass({ name: 'Form 1A', levelType: { name: 'Form 1' } })).toBe(false);
    expect(isSeniorSecondaryClass({ name: 'Grade 1B', levelType: { name: 'Grade 1' } })).toBe(false);
    expect(isSeniorSecondaryClass({ name: 'Grade 6', levelType: { name: 'Grade 6' } })).toBe(false);
    expect(isSeniorSecondaryClass({ name: 'Reception', levelType: null })).toBe(false);
    expect(isSeniorSecondaryClass(null)).toBe(false);
  });
});

describe('CompositeSubjectService.getCompositeResultsForStudent', () => {
  const baseComputed = {
    'sub-physics': { subject: { name: 'Physics' }, finalPercentage: 44.4 },
    'sub-chemistry': { subject: { name: 'Chemistry' }, finalPercentage: 39 },
  };

  it('replaces component subjects with the composite for a senior class', async () => {
    // Science is returned by BOTH the linked and matched candidates — dedupe must yield a single row.
    const prisma = makeFakePrisma({
      composites: { linked: [scienceComposite], scoped: [languageComposite], matched: [scienceComposite, languageComposite] },
      taught: ['sub-physics', 'sub-chemistry', 'sub-eng', 'sub-lit'],
      computed: { ...baseComputed, 'sub-eng': { subject: { name: 'English' }, finalPercentage: 80 }, 'sub-lit': { subject: { name: 'Literature' }, finalPercentage: 70 } },
    });
    const service = new CompositeSubjectService(prisma as any);

    const results = await service.getCompositeResultsForStudent('stu-1', 'term-1', 'class-1', 'school-1');

    expect(results).toHaveLength(2);
    expect(results.map((r: any) => r.composite.code).sort()).toEqual(['EL', 'SCI']);
    const science = results.find((r: any) => r.composite.code === 'SCI');
    expect(science.finalPercentage).toBe(41.7);
    expect(science.components.every((c: any) => c.present)).toBe(true);
  });

  it('filters out composites when any component has no result row (keeps standalone forms 1-4 behavior safe)', async () => {
    const prisma = makeFakePrisma({
      composites: { linked: [scienceComposite], matched: [scienceComposite] },
      taught: ['sub-physics', 'sub-chemistry'],
      computed: { 'sub-physics': baseComputed['sub-physics'], 'sub-chemistry': null },
    });
    const service = new CompositeSubjectService(prisma as any);

    const results = await service.getCompositeResultsForStudent('stu-1', 'term-1', 'class-1', 'school-1');

    expect(results).toHaveLength(0);
  });

  it('returns no composites for a non-senior class even when configured', async () => {
    const prisma = makeFakePrisma({
      klassLevel: 'Form 1',
      klassName: 'Form 1A',
      composites: { linked: [scienceComposite], matched: [scienceComposite] },
      taught: ['sub-physics', 'sub-chemistry'],
      computed: baseComputed,
    });
    const service = new CompositeSubjectService(prisma as any);

    const results = await service.getCompositeResultsForStudent('stu-1', 'term-1', 'class-1', 'school-1');

    expect(results).toHaveLength(0);
  });

  it('does not match composites whose components are not all taught in the class', async () => {
    const prisma = makeFakePrisma({
      composites: { matched: [scienceComposite] },
      taught: ['sub-physics'], // chemistry not taught → Science must not apply
      computed: baseComputed,
    });
    const service = new CompositeSubjectService(prisma as any);

    const results = await service.getCompositeResultsForStudent('stu-1', 'term-1', 'class-1', 'school-1');

    expect(results).toHaveLength(0);
  });
});