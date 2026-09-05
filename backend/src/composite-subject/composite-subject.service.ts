import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mapBounded } from '../common/utils/concurrency.util';

/**
 * Determines whether a class belongs to the senior secondary band (Grade 10-12)
 * where composite subjects apply. Forms 1-4 and other junior bands keep their
 * standalone component subjects (e.g. Physics and Chemistry) unchanged.
 */
export function isSeniorSecondaryClass(klass?: { name?: string; levelType?: { name?: string } } | null): boolean {
  if (!klass) return false;
  const labels = [klass.levelType?.name, klass.name].filter(Boolean) as string[];
  if (labels.some((l) => /\bsenior\b/i.test(l))) return true;
  return labels.some((l) => {
    const numbers = l.match(/\d{1,2}/g) ?? [];
    return numbers.some((t) => {
      const n = Number(t);
      return n >= 10 && n <= 12;
    });
  });
}

/** Loads a composite once per unique id, sharing the work across callers. */
function mergeById<T extends { id: string }>(...lists: T[][]): T[] {
  const seen = new Map<string, T>();
  for (const list of lists) {
    for (const item of list) {
      if (!seen.has(item.id)) seen.set(item.id, item);
    }
  }
  return [...seen.values()];
}

/**
 * Small TTL memo that keeps repeated reads during a busy results pass off the DB.
 * Class and school configuration changes are rare, so a few minutes of reuse is safe.
 */
class MemoCache<T> {
  private store = new Map<string, { exp: number; value: T }>();

  constructor(
    private ttlMs = 5 * 60 * 1000,
    private max = 300,
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.exp) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.max && !this.store.has(key)) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { exp: Date.now() + this.ttlMs, value });
  }
}

@Injectable()
export class CompositeSubjectService {
  private readonly logger = new Logger(CompositeSubjectService.name);
  private readonly classMemo = new MemoCache<any>();
  private readonly candidatesMemo = new MemoCache<any[]>();

  constructor(private prisma: PrismaService) {}

  async create(data: {
    name: string;
    code: string;
    curriculumId: string;
    calculationMethod?: string;
    schoolId?: string;
    components: { subjectId: string; weight: number }[];
  }) {
    const existing = await this.prisma.compositeSubject.findUnique({
      where: { code_curriculumId: { code: data.code, curriculumId: data.curriculumId } },
    });
    if (existing) {
      throw new ConflictException(`Composite subject with code "${data.code}" already exists in this curriculum`);
    }

    return this.prisma.compositeSubject.create({
      data: {
        name: data.name,
        code: data.code,
        curriculumId: data.curriculumId,
        calculationMethod: data.calculationMethod || 'WEIGHTED_AVERAGE',
        schoolId: data.schoolId,
        components: {
          create: data.components.map(c => ({
            subjectId: c.subjectId,
            weight: c.weight,
          })),
        },
      },
      include: {
        components: {
          include: { subject: true },
        },
        curriculum: true,
      },
    });
  }

  async findAll(filters: { curriculumId?: string; schoolId?: string; isActive?: boolean }) {
    const where: any = {};
    if (filters.curriculumId) where.curriculumId = filters.curriculumId;
    if (filters.schoolId) where.schoolId = filters.schoolId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.compositeSubject.findMany({
      where,
      include: {
        components: {
          include: { subject: true },
          orderBy: { weight: 'desc' },
        },
        curriculum: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const composite = await this.prisma.compositeSubject.findUnique({
      where: { id },
      include: {
        components: {
          include: { subject: true },
          orderBy: { weight: 'desc' },
        },
        curriculum: true,
      },
    });
    if (!composite) throw new NotFoundException('Composite subject not found');
    return composite;
  }

  async update(id: string, data: {
    name?: string;
    code?: string;
    calculationMethod?: string;
    isActive?: boolean;
    components?: { subjectId: string; weight: number }[];
  }) {
    const existing = await this.prisma.compositeSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Composite subject not found');

    if (data.code && data.code !== existing.code) {
      const duplicate = await this.prisma.compositeSubject.findUnique({
        where: { code_curriculumId: { code: data.code, curriculumId: existing.curriculumId } },
      });
      if (duplicate) throw new ConflictException('Code already exists in this curriculum');
    }

    if (data.components) {
      await this.prisma.compositeSubjectComponent.deleteMany({ where: { compositeSubjectId: id } });
      await this.prisma.compositeSubjectComponent.createMany({
        data: data.components.map(c => ({
          compositeSubjectId: id,
          subjectId: c.subjectId,
          weight: c.weight,
        })),
      });
    }

    return this.prisma.compositeSubject.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code }),
        ...(data.calculationMethod && { calculationMethod: data.calculationMethod }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        components: {
          include: { subject: true },
          orderBy: { weight: 'desc' },
        },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.compositeSubject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Composite subject not found');
    await this.prisma.compositeSubject.delete({ where: { id } });
    return { deleted: true };
  }

  async computeCompositeForStudent(
    compositeSubjectId: string,
    studentId: string,
    termId: string,
    classId: string,
    schoolId: string,
    compositeCache?: Map<string, any>,
    gradeCache?: Map<string, any>,
    computedMap?: Map<string, { finalPercentage: number | null; subjectName: string }>,
  ) {
    const composite = await this.memoLookup(
      compositeCache,
      `composite|${compositeSubjectId}`,
      () => this.prisma.compositeSubject.findUnique({
        where: { id: compositeSubjectId },
        include: { components: true },
      }),
    );
    if (!composite) throw new NotFoundException('Composite subject not found');

    let totalWeighted = 0;
    let totalWeight = 0;
    const componentResults: { subjectId: string; subjectName: string; percentage: number | null; weight: number; present: boolean }[] = [];

    for (const component of composite.components) {
      // Prefer rows the caller already loaded (bulk results passes); fall back to
      // a per-subject read when computing a single composite in isolation.
      const computed = computedMap
        ? (computedMap.get(component.subjectId) ?? null)
        : await this.prisma.computedResult.findUnique({
            where: {
              studentId_subjectId_termId: {
                studentId,
                subjectId: component.subjectId,
                termId,
              },
            },
            include: { subject: true },
          });
      const row = computed
        ? {
            finalPercentage: computed.finalPercentage,
            subject: { name: computed.subjectName ?? computed.subject?.name },
          }
        : null;

      componentResults.push({
        subjectId: component.subjectId,
        subjectName: row?.subject?.name || component.subjectId,
        percentage: row?.finalPercentage ?? null,
        weight: component.weight,
        present: row != null,
      });

      if (row?.finalPercentage != null) {
        totalWeighted += row.finalPercentage * component.weight;
        totalWeight += component.weight;
      }
    }

    if (totalWeight === 0) {
      return { composite, finalPercentage: null, finalGrade: null, components: componentResults };
    }

    const finalPct = parseFloat((totalWeighted / totalWeight).toFixed(2));
    const finalGrade = await this.computeGrade(finalPct, classId, compositeSubjectId, termId, schoolId, gradeCache);

    return {
      composite: { id: composite.id, name: composite.name, code: composite.code },
      finalPercentage: finalPct,
      finalGrade,
      components: componentResults,
    };
  }

  async recomputeAllComposites(
    componentSubjectId: string,
    classId: string,
    termId: string,
    schoolId: string,
  ) {
    const composites = await this.prisma.compositeSubject.findMany({
      where: {
        isActive: true,
        components: { some: { subjectId: componentSubjectId } },
      },
      include: { components: true },
    });

    if (composites.length === 0) return [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { studentId: true },
    });

    const jobs = composites.flatMap(composite => enrollments.map(enrollment => ({
      compositeId: composite.id,
      studentId: enrollment.studentId,
    })));
    const results = await mapBounded(jobs, job => this.computeCompositeForStudent(
      job.compositeId,
      job.studentId,
      termId,
      classId,
      schoolId,
    ), 8);
    return results.filter(Boolean);
  }

  async findEnrollments(classId: string, termId: string) {
    return this.prisma.enrollment.findMany({
      where: { classId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { studentId: true },
    });
  }

  async recomputeAllCompositesForClass(classId: string, termId: string, schoolId: string) {
    const composites = await this.prisma.compositeSubject.findMany({
      where: {
        isActive: true,
        components: { some: {} },
        curriculum: {
          schoolCurricula: { some: { schoolId, isActive: true } },
        },
      },
      include: { components: true },
    });

    if (composites.length === 0) return [];

    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, academicYear: { terms: { some: { id: termId } } }, status: 'ACTIVE', student: { status: 'ACTIVE' } },
      select: { studentId: true },
    });

    // Run the composite×student matrix with bounded concurrency instead of a
    // fully serial N+1 loop, and share the composite/grading lookups across the
    // whole pass so identical queries are not re-issued for every student.
    const compositeCache = new Map<string, any>();
    const gradeCache = new Map<string, any>();
    const jobs = composites.flatMap(composite => enrollments.map(enrollment => ({
      compositeId: composite.id,
      studentId: enrollment.studentId,
    })));
    const results = await mapBounded(
      jobs,
      job => this.computeCompositeForStudent(
        job.compositeId,
        job.studentId,
        termId,
        classId,
        schoolId,
        compositeCache,
        gradeCache,
      ),
      8,
    );
    return results.filter(Boolean);
  }

  /**
   * Resolves the candidate composite subjects that can apply to a class. The
   * result depends only on (classId, termId, schoolId), never on the student, so
   * it is computed once and shared across every student in a results pass.
   */
  async getCompositeCandidatesForClass(classId: string, termId: string, schoolId: string): Promise<any[]> {
    const key = `${classId}|${termId}|${schoolId}`;
    const cached = this.candidatesMemo.get(key);
    if (cached !== undefined) return cached;
    const candidates = await this.loadCompositeCandidates(classId, termId, schoolId);
    this.candidatesMemo.set(key, candidates);
    return candidates;
  }

  private async loadCompositeCandidates(classId: string, termId: string, schoolId: string): Promise<any[]> {
    const klass = await this.getClass(classId);
    // Composite subjects only replace their components in the senior band
    // (Grade 10-12). Forms 1-4 and other junior bands keep the standalone
    // subjects (e.g. Physics and Chemistry) untouched.
    if (!isSeniorSecondaryClass(klass)) return [];

    const [linked, scoped, taughtIds] = await Promise.all([
      // Composites attached to the curriculum versions the school linked (existing path).
      this.prisma.compositeSubject.findMany({
        where: {
          isActive: true,
          curriculum: { schoolCurricula: { some: { schoolId, isActive: true } } },
        },
        include: { components: { include: { subject: true } } },
      }),
      // Composites scoped to this school, or hosted on curriculum versions the school owns.
      this.prisma.compositeSubject.findMany({
        where: {
          isActive: true,
          OR: [{ schoolId }, { curriculum: { schoolId } }],
        },
        include: { components: { include: { subject: true } } },
      }),
      // Subjects actually taught in this class for the term's academic year.
      this.prisma.teachingAssignment.findMany({
        where: { classId, academicYear: { terms: { some: { id: termId } } } },
        select: { subjectId: true },
      }),
    ]);

    const taughtSubjectIds = [...new Set(taughtIds.map((t) => t.subjectId))];

    // Components of a composite must all be taught in this class. This makes the
    // feature work even when the school never linked the composite's curriculum
    // version, and never fabricates a composite for a class that does not teach
    // every component subject.
    const matched = taughtSubjectIds.length > 0
      ? await this.prisma.compositeSubject.findMany({
          where: {
            isActive: true,
            components: {
              some: {},
              every: { subjectId: { in: taughtSubjectIds } },
            },
          },
          include: { components: { include: { subject: true } } },
        })
      : [];

    return mergeById(linked, scoped, matched);
  }

  private async getClass(classId: string): Promise<any> {
    const cached = this.classMemo.get(classId);
    if (cached !== undefined) return cached;
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { levelType: { select: { name: true } } },
    });
    this.classMemo.set(classId, klass);
    return klass ?? null;
  }

  async getCompositeResultsForStudent(
    studentId: string,
    termId: string,
    classId: string,
    schoolId: string,
    options?: {
      /** subjectId → { finalPercentage, subjectName } already loaded by the caller, skips per-component DB reads. */
      computedMap?: Map<string, { finalPercentage: number | null; subjectName: string }>;
      /** shared across students to avoid re-reading grading scales for every recipient. */
      gradeCache?: Map<string, any>;
    },
  ) {
    if (!isSeniorSecondaryClass(await this.getClass(classId))) return [];

    const candidates = await this.getCompositeCandidatesForClass(classId, termId, schoolId);

    const results: any[] = [];
    for (const composite of candidates) {
      const computed = await this.computeCompositeForStudent(
        composite.id, studentId, termId, classId, schoolId,
        undefined, options?.gradeCache, options?.computedMap,
      );
      // Only display the composite when every component subject actually has a
      // result row for this student (present or absent). Otherwise the components
      // are left as standalone subjects.
      if (computed && computed.components.every((c: any) => c.present)) {
        results.push(computed);
      }
    }
    return results;
  }

  private async computeGrade(
    percentage: number,
    classId: string,
    subjectId: string,
    termId: string,
    schoolId: string,
    gradeCache?: Map<string, any>,
  ): Promise<string | null> {
    try {
      // 1. Class-specific grading system (highest priority)
      if (classId) {
        const cls = await this.memoLookup(gradeCache, `class|${classId}`, () => this.prisma.class.findUnique({
          where: { id: classId },
          include: {
            gradingSystem: {
              include: { gradeScales: { orderBy: { minScore: 'asc' } } },
            },
          },
        }));
        if (cls?.gradingSystem?.gradeScales?.length > 0) {
          const scale = cls.gradingSystem.gradeScales.find(
            s => percentage >= s.minScore && percentage < s.maxScore + 1,
          );
          if (scale) return scale.grade;
        }
      }

      // 2. School default grading system
      const defaultSystem = await this.memoLookup(gradeCache, `default|${schoolId}`, () => this.prisma.gradingSystem.findFirst({
        where: { schoolId, isDefault: true },
        include: { gradeScales: { orderBy: { minScore: 'asc' } } },
      }));
      if (defaultSystem?.gradeScales?.length > 0) {
        const scale = defaultSystem.gradeScales.find(
          s => percentage >= s.minScore && percentage < s.maxScore + 1,
        );
        if (scale) return scale.grade;
      }

      // 3. Any grading system for the school
      const anySystem = await this.memoLookup(gradeCache, `any|${schoolId}`, () => this.prisma.gradingSystem.findFirst({
        where: { schoolId },
        include: { gradeScales: { orderBy: { minScore: 'asc' } } },
      }));
      if (anySystem?.gradeScales?.length > 0) {
        const scale = anySystem.gradeScales.find(
          s => percentage >= s.minScore && percentage < s.maxScore + 1,
        );
        if (scale) return scale.grade;
      }

      return null;
    } catch {
      return null;
    }
  }

  private async memoLookup<T>(
    cache: Map<string, any> | undefined,
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (cache?.has(key)) return cache.get(key) as T;
    const value = await loader();
    if (cache) cache.set(key, value);
    return value;
  }
}
