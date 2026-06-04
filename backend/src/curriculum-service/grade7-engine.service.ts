import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  rawScore: number;
  maxScore: number;
}

interface ConvertedSubjectScore {
  subjectName: string;
  rawScore: number;
  convertedScore: number;
  multiplier: number;
  standardizedMax: number;
}

interface BestSubjectSelection {
  selected: ConvertedSubjectScore[];
  total: number;
  rule: string;
}

interface DivisionResult {
  division: string;
  score: number;
  label: string;
  color: string;
}

interface Grade7ComputationResult {
  studentId: string;
  studentName: string;
  scores: ConvertedSubjectScore[];
  bestFour: ConvertedSubjectScore[];
  bestFourTotal: number;
  englishScore: ConvertedSubjectScore | null;
  mathematicsScore: ConvertedSubjectScore | null;
  specialPapers: ConvertedSubjectScore[];
  specialPapersTotal: number;
  finalAggregate: number;
  division: DivisionResult | null;
  performanceCategory: string | null;
  details: string[];
}

@Injectable()
export class Grade7EngineService {
  constructor(private prisma: PrismaService) {}

  async computeGrade7Result(
    studentId: string,
    termId: string,
    curriculumVersionId?: string,
    examStructureId?: string,
  ): Promise<Grade7ComputationResult> {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { school: true },
    });
    if (!student) throw new NotFoundException('Student not found');

    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    });
    if (!term) throw new NotFoundException('Term not found');

    const results = await this.prisma.result.findMany({
      where: { studentId, termId, schoolId: student.schoolId },
      include: { subject: true },
    });
    if (results.length === 0) throw new NotFoundException('No results found for this student');

    const examStructure = examStructureId
      ? await this.getExamStructure(examStructureId)
      : await this.getDefaultExamStructure(student.schoolId);

    const conversionRules = examStructureId
      ? await this.prisma.subjectConversionRule.findMany({
          where: {
            schoolId: { in: [student.schoolId, null] },
            curriculumVersionId: examStructure.curriculumVersionId || undefined,
            isActive: true,
          },
        })
      : await this.prisma.subjectConversionRule.findMany({
          where: { schoolId: { in: [student.schoolId, null] }, isActive: true },
        });

    const details: string[] = [];

    // Step 1: Convert scores using conversion rules
    const convertedScores: ConvertedSubjectScore[] = results.map((r) => {
      const rule = conversionRules.find(
        (cr) => cr.subjectId === r.subjectId,
      );
      let convertedScore = r.score;
      let multiplier = 1;
      const standardizedMax = rule?.standardizedMax || 100;

      if (rule) {
        multiplier = rule.conversionMultiplier || (standardizedMax / rule.actualMaxScore);
        convertedScore = r.score * multiplier;
        if (rule.conversionFormula) {
          try {
            const fn = new Function('actual', 'max', `return ${rule.conversionFormula}`);
            convertedScore = fn(r.score, rule.actualMaxScore);
          } catch {
            convertedScore = r.score * multiplier;
          }
        }
        convertedScore = Math.min(convertedScore, standardizedMax);
        details.push(`${r.subject.name}: ${r.score} × ${multiplier} = ${convertedScore.toFixed(1)} (max ${standardizedMax})`);
      } else {
        details.push(`${r.subject.name}: ${r.score} (no conversion rule)`);
      }

      return {
        subjectName: r.subject.name,
        rawScore: r.score,
        convertedScore: Math.round(convertedScore * 10) / 10,
        multiplier,
        standardizedMax,
      };
    });

    details.push(`--- Converted ${convertedScores.length} subjects ---`);

    // Step 2: Find English and Math scores
    const englishScore = this.findSubject(convertedScores, ['english', 'english language', 'eng']);
    const mathematicsScore = this.findSubject(convertedScores, ['mathematics', 'math', 'maths']);

    if (!englishScore) details.push('WARNING: English score not found');
    if (!mathematicsScore) details.push('WARNING: Mathematics score not found');

    // Step 3: Select best four (must include English + Math + best additional)
    const bestFour = this.selectBestSubjects(convertedScores, englishScore, mathematicsScore);
    const bestFourTotal = bestFour.reduce((sum, s) => sum + s.convertedScore, 0);
    details.push(`Best Four: ${bestFour.map((s) => `${s.subjectName}=${s.convertedScore}`).join(' + ')} = ${bestFourTotal}`);

    // Step 4: Find special papers (SP1, SP2)
    const specialPapers = convertedScores.filter(
      (s) => s.subjectName.toLowerCase().includes('sp1') || s.subjectName.toLowerCase().includes('special paper 1')
        || s.subjectName.toLowerCase().includes('sp2') || s.subjectName.toLowerCase().includes('special paper 2')
        || s.subjectName.toLowerCase().includes('special paper'),
    );
    const specialPapersTotal = specialPapers.reduce((sum, s) => sum + s.convertedScore, 0);
    details.push(`Special Papers: ${specialPapers.map((s) => `${s.subjectName}=${s.convertedScore}`).join(' + ')} = ${specialPapersTotal}`);

    // Step 5: Compute final aggregate
    const finalAggregate = bestFourTotal + specialPapersTotal;
    details.push(`Final Aggregate: ${bestFourTotal} + ${specialPapersTotal} = ${finalAggregate}`);

    // Step 6: Determine division
    const division = await this.computeDivision(finalAggregate, examStructureId);

    // Step 7: Determine performance category
    const performanceCategory = await this.computePerformanceCategory(finalAggregate, examStructure);

    return {
      studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      scores: convertedScores,
      bestFour,
      bestFourTotal,
      englishScore,
      mathematicsScore,
      specialPapers,
      specialPapersTotal,
      finalAggregate,
      division,
      performanceCategory,
      details,
    };
  }

  async saveGrade7Result(studentId: string, termId: string, computation: Grade7ComputationResult) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    const term = await this.prisma.term.findUnique({ where: { id: termId } });

    const getScore = (name: string) => {
      const found = computation.scores.find(
        (s) => s.subjectName.toLowerCase().includes(name),
      );
      return found?.convertedScore || null;
    };

    return this.prisma.grade7Result.upsert({
      where: { studentId_termId: { studentId, termId } },
      create: {
        studentId,
        termId,
        academicYearId: term.academicYearId,
        schoolId: student.schoolId,
        englishConverted: getScore('english'),
        mathematicsConverted: getScore('math'),
        scienceConverted: getScore('science') || getScore('integrated science'),
        socialStudiesConverted: getScore('social studies') || getScore('social'),
        zambianLanguageConverted: getScore('zambian') || getScore('local language'),
        expressiveArtsConverted: getScore('expressive arts') || getScore('ea'),
        homeEconomicsConverted: getScore('home economics') || getScore('he'),
        technologyStudiesConverted: getScore('technology studies') || getScore('ts'),
        ctsConverted: getScore('cts'),
        sp1Converted: getScore('sp1'),
        sp2Converted: getScore('sp2'),
        bestFourTotal: computation.bestFourTotal,
        specialPapersTotal: computation.specialPapersTotal,
        finalAggregate: computation.finalAggregate,
        division: computation.division?.division || null,
        divisionScore: computation.division?.score || null,
        performanceCategory: computation.performanceCategory,
      },
      update: {
        englishConverted: getScore('english'),
        mathematicsConverted: getScore('math'),
        scienceConverted: getScore('science') || getScore('integrated science'),
        socialStudiesConverted: getScore('social studies') || getScore('social'),
        zambianLanguageConverted: getScore('zambian') || getScore('local language'),
        expressiveArtsConverted: getScore('expressive arts') || getScore('ea'),
        homeEconomicsConverted: getScore('home economics') || getScore('he'),
        technologyStudiesConverted: getScore('technology studies') || getScore('ts'),
        ctsConverted: getScore('cts'),
        sp1Converted: getScore('sp1'),
        sp2Converted: getScore('sp2'),
        bestFourTotal: computation.bestFourTotal,
        specialPapersTotal: computation.specialPapersTotal,
        finalAggregate: computation.finalAggregate,
        division: computation.division?.division || null,
        divisionScore: computation.division?.score || null,
        performanceCategory: computation.performanceCategory,
        computedAt: new Date(),
      },
    });
  }

  async batchComputeGrade7(classId: string, termId: string, curriculumVersionId?: string, examStructureId?: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: { student: true },
    });

    const results: Grade7ComputationResult[] = [];
    const errors: Array<{ studentId: string; studentName: string; error: string }> = [];

    for (const enrollment of enrollments) {
      try {
        const computation = await this.computeGrade7Result(
          enrollment.student.id,
          termId,
          curriculumVersionId,
          examStructureId,
        );
        await this.saveGrade7Result(enrollment.student.id, termId, computation);
        results.push(computation);
      } catch (err: any) {
        errors.push({
          studentId: enrollment.student.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          error: err.message,
        });
      }
    }

    return { total: enrollments.length, computed: results.length, errors, results };
  }

  async getGrade7Results(studentId?: string, termId?: string, schoolId?: string) {
    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (termId) where.termId = termId;
    if (schoolId) where.schoolId = schoolId;
    return this.prisma.grade7Result.findMany({
      where,
      include: { student: true, term: true, examStructure: true, curriculumVersion: true },
      orderBy: { finalAggregate: 'desc' },
    });
  }

  async rankGrade7Results(schoolId: string, termId: string) {
    const results = await this.prisma.grade7Result.findMany({
      where: { schoolId, termId },
      orderBy: { finalAggregate: 'desc' },
    });

    const updates = results.map((r, i) =>
      this.prisma.grade7Result.update({
        where: { id: r.id },
        data: { schoolRank: i + 1 },
      }),
    );
    await this.prisma.$transaction(updates);

    return results.map((r, i) => ({
      ...r,
      schoolRank: i + 1,
    }));
  }

  // ===================== PRIVATE HELPERS =====================

  private findSubject(scores: ConvertedSubjectScore[], names: string[]): ConvertedSubjectScore | null {
    return scores.find((s) =>
      names.some((n) => s.subjectName.toLowerCase().includes(n)),
    ) || null;
  }

  private selectBestSubjects(
    scores: ConvertedSubjectScore[],
    english: ConvertedSubjectScore | null,
    math: ConvertedSubjectScore | null,
  ): ConvertedSubjectScore[] {
    const selected: ConvertedSubjectScore[] = [];

    if (english) selected.push(english);
    if (math && math !== english) selected.push(math);

    // Exclude special papers (SP1, SP2) from best four selection
    // ECZ standard: best 4 = core subjects only, SP1/SP2 are separate components
    const remaining = scores.filter(
      (s) => !selected.includes(s)
        && !s.subjectName.toLowerCase().includes('sp1')
        && !s.subjectName.toLowerCase().includes('sp2')
        && !s.subjectName.toLowerCase().includes('special paper'),
    ).sort((a, b) => b.convertedScore - a.convertedScore);

    const slotsLeft = 4 - selected.length;
    if (slotsLeft > 0) {
      selected.push(...remaining.slice(0, slotsLeft));
    }

    return selected;
  }

  private async computeDivision(
    aggregate: number,
    examStructureId?: string,
  ): Promise<DivisionResult | null> {
    const rules = await this.prisma.divisionRule.findMany({
      where: examStructureId ? { examStructureId } : {},
      orderBy: { sortOrder: 'asc' },
    });

    if (rules.length === 0) {
      // Default ECZ selection composite divisions (best 4 + SP1 + SP2, max 900)
      if (aggregate >= 683) return { division: 'Division 1', score: aggregate, label: 'Excellent', color: '#16a34a' };
      if (aggregate >= 623) return { division: 'Division 2', score: aggregate, label: 'Very Good', color: '#2563eb' };
      if (aggregate >= 589) return { division: 'Division 3', score: aggregate, label: 'Good', color: '#ca8a04' };
      if (aggregate >= 300) return { division: 'Division 4', score: aggregate, label: 'Average', color: '#ea580c' };
      return { division: 'Unclassified', score: aggregate, label: 'Below Minimum', color: '#dc2626' };
    }

    for (const rule of rules) {
      if (aggregate >= rule.minScore && aggregate <= rule.maxScore) {
        return {
          division: rule.division,
          score: aggregate,
          label: rule.label || rule.name,
          color: rule.color || '#6b7280',
        };
      }
    }

    return { division: 'Unclassified', score: aggregate, label: 'N/A', color: '#6b7280' };
  }

  private async computePerformanceCategory(
    aggregate: number,
    examStructure?: any,
  ): Promise<string | null> {
    const categories = await this.prisma.performanceCategory.findMany({
      where: {
        curriculumVersionId: examStructure?.curriculumVersionId || undefined,
        name: { startsWith: 'COMPOSITE_' },  // Only composite-scale categories
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (categories.length === 0) {
      // Fallback: use selection composite division ranges
      if (aggregate >= 683) return 'One';
      if (aggregate >= 623) return 'Two';
      if (aggregate >= 589) return 'Three';
      if (aggregate >= 300) return 'Four';
      return 'Five';
    }

    for (const cat of categories) {
      if (cat.minScore !== null && cat.maxScore !== null) {
        if (aggregate >= cat.minScore && aggregate <= cat.maxScore) return cat.name.replace('COMPOSITE_', '');
      }
    }

    return categories[categories.length - 1]?.name.replace('COMPOSITE_', '') || 'Four';
  }

  private async getDefaultExamStructure(schoolId: string) {
    return this.prisma.examStructure.findFirst({
      where: {
        academicStage: {
          code: { in: ['G7', 'GRADE_7', 'GRADE7'] },
        },
      },
      include: { components: true },
    });
  }

  private async getExamStructure(examStructureId: string) {
    const structure = await this.prisma.examStructure.findUnique({
      where: { id: examStructureId },
      include: { components: true },
    });
    if (!structure) throw new NotFoundException('Exam structure not found');
    return structure;
  }
}
