import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const school = await prisma.school.findFirst({
    where: { name: { equals: 'ADASTRA SECONDARY SCHOOL', mode: 'insensitive' } },
    select: { id: true, name: true },
  });

  if (!school) throw new Error('ADASTRA SECONDARY SCHOOL was not found');

  const terms = await prisma.term.findMany({
    where: {
      name: { equals: 'Term 3', mode: 'insensitive' },
      academicYear: { schoolId: school.id },
    },
    select: { id: true, name: true, academicYear: { select: { name: true } } },
  });

  if (terms.length === 0) throw new Error('No Term 3 was found for Adastra Secondary School');
  const termIds = terms.map(t => t.id);

  const computed = await prisma.computedResult.findMany({
    where: { schoolId: school.id, termId: { in: termIds }, examType: 'END_TERM' },
    select: {
      id: true,
      studentId: true,
      subjectId: true,
      termId: true,
      classId: true,
      schoolId: true,
      totalRawScore: true,
      totalWeightedScore: true,
      finalPercentage: true,
      finalGrade: true,
      finalRemark: true,
      classRank: true,
      subjectRank: true,
      gpa: true,
      points: true,
      status: true,
      isAbsent: true,
      computedAt: true,
      verifiedBy: true,
      verifiedAt: true,
      metadata: true,
    },
  });

  const sheets = await prisma.resultSheet.findMany({
    where: { schoolId: school.id, termId: { in: termIds }, examType: 'END_TERM' },
    select: { id: true, classId: true, termId: true, status: true },
  });

  console.log(JSON.stringify({
    apply: APPLY,
    school: school.name,
    terms: terms.map(t => `${t.academicYear.name} ${t.name}`),
    computedResults: computed.length,
    resultSheets: sheets.length,
  }, null, 2));

  if (!APPLY) return;

  await prisma.$transaction(async (tx) => {
    for (const row of computed) {
      await tx.computedResult.upsert({
        where: {
          studentId_subjectId_termId_examType: {
            studentId: row.studentId,
            subjectId: row.subjectId,
            termId: row.termId,
            examType: 'MID_TERM',
          },
        },
        update: {
          classId: row.classId,
          schoolId: row.schoolId,
          totalRawScore: row.totalRawScore,
          totalWeightedScore: row.totalWeightedScore,
          finalPercentage: row.finalPercentage,
          finalGrade: row.finalGrade,
          finalRemark: row.finalRemark,
          classRank: row.classRank,
          subjectRank: row.subjectRank,
          gpa: row.gpa,
          points: row.points,
          status: row.status,
          isAbsent: row.isAbsent,
          computedAt: row.computedAt,
          verifiedBy: row.verifiedBy,
          verifiedAt: row.verifiedAt,
          metadata: row.metadata,
        },
        create: {
          studentId: row.studentId,
          subjectId: row.subjectId,
          termId: row.termId,
          examType: 'MID_TERM',
          classId: row.classId,
          schoolId: row.schoolId,
          totalRawScore: row.totalRawScore,
          totalWeightedScore: row.totalWeightedScore,
          finalPercentage: row.finalPercentage,
          finalGrade: row.finalGrade,
          finalRemark: row.finalRemark,
          classRank: row.classRank,
          subjectRank: row.subjectRank,
          gpa: row.gpa,
          points: row.points,
          status: row.status,
          isAbsent: row.isAbsent,
          computedAt: row.computedAt,
          verifiedBy: row.verifiedBy,
          verifiedAt: row.verifiedAt,
          metadata: row.metadata,
        },
      });
      await tx.computedResult.delete({ where: { id: row.id } });
    }

    for (const sheet of sheets) {
      const midSheet = await tx.resultSheet.findUnique({
        where: { classId_termId_examType: { classId: sheet.classId, termId: sheet.termId, examType: 'MID_TERM' } },
        select: { id: true },
      });
      if (midSheet) await tx.resultSheet.delete({ where: { id: midSheet.id } });
      await tx.resultSheet.update({ where: { id: sheet.id }, data: { examType: 'MID_TERM' } });
    }
  }, { maxWait: 30000, timeout: 120000 });

  console.log(`Reclassified ${computed.length} computed results and ${sheets.length} result sheets to MID_TERM.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
