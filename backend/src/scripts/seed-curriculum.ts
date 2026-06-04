import { PrismaClient, EducationLevelCategory, SubjectCategory, PathwayType } from '@prisma/client';

const prisma = new PrismaClient();

// Helper: upsert with nullable fields in unique constraints
// Prisma doesn't allow null in upsert where clauses, so we use findFirst + create/update
async function upsertByFilter(model: any, filter: any, data: any) {
  const existing = await model.findFirst({ where: filter });
  if (existing) return model.update({ where: { id: existing.id }, data });
  return model.create({ data });
}

async function main() {
  console.log('Seeding Zambian Curriculum Structure...');

  // ===================== 1. EDUCATION LEVELS =====================
  const ece = await upsertByFilter(
    prisma.educationLevel,
    { code: EducationLevelCategory.ECE, schoolId: null },
    { name: 'Early Childhood Education', code: EducationLevelCategory.ECE, description: 'Pre-primary education for children aged 3-6' },
  );

  const primary = await upsertByFilter(
    prisma.educationLevel,
    { code: EducationLevelCategory.PRIMARY, schoolId: null },
    { name: 'Primary Education', code: EducationLevelCategory.PRIMARY, description: 'Grade 1 to Grade 7 primary school education' },
  );

  const secondary = await upsertByFilter(
    prisma.educationLevel,
    { code: EducationLevelCategory.SECONDARY, schoolId: null },
    { name: 'Secondary Education', code: EducationLevelCategory.SECONDARY, description: 'Form 1 to Form 4 secondary school education' },
  );

  const advancedSecondary = await upsertByFilter(
    prisma.educationLevel,
    { code: EducationLevelCategory.ADVANCED_SECONDARY, schoolId: null },
    { name: 'Advanced Secondary Education', code: EducationLevelCategory.ADVANCED_SECONDARY, description: 'Form 5 to Form 6 advanced level secondary education' },
  );

  console.log('Education levels created');

  // ===================== 2. CURRICULUM VERSIONS =====================
  const curr2024Primary = await upsertByFilter(
    prisma.curriculumVersion,
    { code: 'ZAMBIA_2024_PRIMARY', schoolId: null },
    {
      name: 'Zambia 2024 Primary Curriculum',
      code: 'ZAMBIA_2024_PRIMARY',
      description: 'Current Zambian primary education curriculum (2024)',
      status: 'CURRENT',
      educationLevelId: primary.id,
      isCurrent: true,
      effectiveFrom: new Date('2024-01-01'),
    },
  );

  const curr2024Secondary = await upsertByFilter(
    prisma.curriculumVersion,
    { code: 'ZAMBIA_2024_SECONDARY_TRANSITIONAL', schoolId: null },
    {
      name: 'Zambia 2024 Secondary Curriculum (Transitional)',
      code: 'ZAMBIA_2024_SECONDARY_TRANSITIONAL',
      description: 'Transitional secondary curriculum — Form 1, Form 2, Grade 10, Grade 11, Grade 12',
      status: 'CURRENT',
      educationLevelId: secondary.id,
      isCurrent: true,
      effectiveFrom: new Date('2024-01-01'),
    },
  );

  const curr2025Secondary = await upsertByFilter(
    prisma.curriculumVersion,
    { code: 'ZAMBIA_2025_SECONDARY', schoolId: null },
    {
      name: 'Zambia 2025 Secondary Curriculum (Next Phase)',
      code: 'ZAMBIA_2025_SECONDARY',
      description: 'Next phase secondary curriculum — Form 1, Form 2, Form 3, Grade 11, Grade 12',
      status: 'FUTURE',
      educationLevelId: secondary.id,
      isCurrent: false,
      effectiveFrom: new Date('2025-01-01'),
    },
  );

  const currFutureSecondary = await upsertByFilter(
    prisma.curriculumVersion,
    { code: 'ZAMBIA_FUTURE_SECONDARY', schoolId: null },
    {
      name: 'Zambia Future Secondary Curriculum (Full Form)',
      code: 'ZAMBIA_FUTURE_SECONDARY',
      description: 'Future full Form structure — Form 1 through Form 6',
      status: 'FUTURE',
      educationLevelId: secondary.id,
      isCurrent: false,
      effectiveFrom: new Date('2027-01-01'),
    },
  );

  console.log('Curriculum versions created');

  // ===================== 3. ACADEMIC STAGES =====================

  // Primary stages
  const primaryStages = [
    { name: 'ECE', code: 'ECE', sortOrder: 1 },
    { name: 'Grade 1', code: 'G1', sortOrder: 2 },
    { name: 'Grade 2', code: 'G2', sortOrder: 3 },
    { name: 'Grade 3', code: 'G3', sortOrder: 4 },
    { name: 'Grade 4', code: 'G4', sortOrder: 5 },
    { name: 'Grade 5', code: 'G5', sortOrder: 6 },
    { name: 'Grade 6', code: 'G6', sortOrder: 7 },
    { name: 'Grade 7', code: 'G7', sortOrder: 8 },
  ];

  for (const stage of primaryStages) {
    await upsertByFilter(
      prisma.academicStage,
      { code: stage.code, curriculumVersionId: curr2024Primary.id, schoolId: null },
      {
        name: stage.name,
        code: stage.code,
        sortOrder: stage.sortOrder,
        educationLevelId: primary.id,
        curriculumVersionId: curr2024Primary.id,
      },
    );
  }

  // Secondary stages — transitional (current)
  const secondaryTransitionalStages = [
    { name: 'Form 1', code: 'F1', sortOrder: 1 },
    { name: 'Form 2', code: 'F2', sortOrder: 2 },
    { name: 'Grade 10', code: 'G10', sortOrder: 3 },
    { name: 'Grade 11', code: 'G11', sortOrder: 4 },
    { name: 'Grade 12', code: 'G12', sortOrder: 5 },
  ];

  for (const stage of secondaryTransitionalStages) {
    await upsertByFilter(
      prisma.academicStage,
      { code: stage.code, curriculumVersionId: curr2024Secondary.id, schoolId: null },
      {
        name: stage.name,
        code: stage.code,
        sortOrder: stage.sortOrder,
        educationLevelId: secondary.id,
        curriculumVersionId: curr2024Secondary.id,
      },
    );
  }

  // Secondary stages — next phase (2025)
  const secondaryNextStages = [
    { name: 'Form 1', code: 'F1', sortOrder: 1 },
    { name: 'Form 2', code: 'F2', sortOrder: 2 },
    { name: 'Form 3', code: 'F3', sortOrder: 3 },
    { name: 'Grade 11', code: 'G11', sortOrder: 4 },
    { name: 'Grade 12', code: 'G12', sortOrder: 5 },
  ];

  for (const stage of secondaryNextStages) {
    await upsertByFilter(
      prisma.academicStage,
      { code: stage.code, curriculumVersionId: curr2025Secondary.id, schoolId: null },
      {
        name: stage.name,
        code: stage.code,
        sortOrder: stage.sortOrder,
        educationLevelId: secondary.id,
        curriculumVersionId: curr2025Secondary.id,
      },
    );
  }

  // Secondary stages — future full form structure
  const secondaryFutureStages = [
    { name: 'Form 1', code: 'F1', sortOrder: 1 },
    { name: 'Form 2', code: 'F2', sortOrder: 2 },
    { name: 'Form 3', code: 'F3', sortOrder: 3 },
    { name: 'Form 4', code: 'F4', sortOrder: 4 },
    { name: 'Form 5', code: 'F5', sortOrder: 5 },
    { name: 'Form 6', code: 'F6', sortOrder: 6 },
  ];

  for (const stage of secondaryFutureStages) {
    await upsertByFilter(
      prisma.academicStage,
      { code: stage.code, curriculumVersionId: currFutureSecondary.id, schoolId: null },
      {
        name: stage.name,
        code: stage.code,
        sortOrder: stage.sortOrder,
        educationLevelId: secondary.id,
        curriculumVersionId: currFutureSecondary.id,
      },
    );
  }

  console.log('Academic stages created');

  // ===================== 4. ECZ GRADE 7 SUBJECT CONVERSION RULES =====================

  // ECZ Grade 7 subjects with their actual paper totals (T)
  // Formula: standardizedScore = (rawScore / actualMaxScore) * 100 + 50 => scale 50-150
  const conversionRules = [
    { name: 'English Grade 7 Conversion', subjectCode: 'ENGLISH',          actualMax: 60, stdMax: 150 },
    { name: 'Mathematics Grade 7 Conversion', subjectCode: 'MATHEMATICS',  actualMax: 60, stdMax: 150 },
    { name: 'Integrated Science Grade 7 Conversion', subjectCode: 'SCIENCE', actualMax: 50, stdMax: 150 },
    { name: 'Social Studies Grade 7 Conversion', subjectCode: 'SOCIAL_STUDIES', actualMax: 60, stdMax: 150 },
    { name: 'CTS/CATS Grade 7 Conversion', subjectCode: 'CTS',             actualMax: 60, stdMax: 150 },
    { name: 'Zambian Language Grade 7 Conversion', subjectCode: 'ZAMBIAN_LANG',  actualMax: 50, stdMax: 150 },
    { name: 'Special Paper 1 Grade 7 Conversion', subjectCode: 'SP1',      actualMax: 50, stdMax: 150 },
    { name: 'Special Paper 2 Grade 7 Conversion', subjectCode: 'SP2',      actualMax: 50, stdMax: 150 },
  ];

  for (const rule of conversionRules) {
    const existingSubject = await prisma.subject.findFirst({
      where: { code: rule.subjectCode },
    });

    if (existingSubject) {
      await upsertByFilter(
        prisma.subjectConversionRule,
        { subjectId: existingSubject.id, curriculumVersionId: curr2024Primary.id, schoolId: null },
        {
          name: rule.name,
          subjectId: existingSubject.id,
          actualMaxScore: rule.actualMax,
          standardizedMax: rule.stdMax,
          conversionFormula: '(actual / max) * 100 + 50',
          curriculumVersionId: curr2024Primary.id,
          effectiveYear: 2024,
        },
      );
    }
  }

  console.log('Subject conversion rules created');

  // ===================== 5. ECZ GRADE 7 DIVISION RULES =====================

  // ECZ Grade 7 official division cutoffs (per single subject, standardized 50-150 scale)
  const divisions = [
    { name: 'Division 1 — Excellent', code: 'DIV_1', division: 'Division 1', min: 115, max: 150, label: 'Excellent', color: '#16a34a', sort: 1 },
    { name: 'Division 2 — Very Good', code: 'DIV_2', division: 'Division 2', min: 105, max: 114, label: 'Very Good', color: '#2563eb', sort: 2 },
    { name: 'Division 3 — Good', code: 'DIV_3', division: 'Division 3', min: 99, max: 104, label: 'Good', color: '#ca8a04', sort: 3 },
    { name: 'Division 4 — Average', code: 'DIV_4', division: 'Division 4', min: 50, max: 98, label: 'Average', color: '#ea580c', sort: 4 },
  ];

  for (const d of divisions) {
    await upsertByFilter(
      prisma.divisionRule,
      { code: d.code, curriculumVersionId: curr2024Primary.id, schoolId: null },
      {
        name: d.name, code: d.code, division: d.division,
        minScore: d.min, maxScore: d.max, label: d.label, color: d.color,
        curriculumVersionId: curr2024Primary.id, sortOrder: d.sort,
      },
    );
  }

  // Certificate classification divisions (best 4 subjects total, 200-600 scale)
  const certDivisions = [
    { name: 'Certificate Division 1', code: 'CERT_DIV_1', division: 'Division 1', min: 460, max: 600, label: 'Excellent', color: '#16a34a', sort: 1 },
    { name: 'Certificate Division 2', code: 'CERT_DIV_2', division: 'Division 2', min: 422, max: 459, label: 'Very Good', color: '#2563eb', sort: 2 },
    { name: 'Certificate Division 3', code: 'CERT_DIV_3', division: 'Division 3', min: 398, max: 421, label: 'Good', color: '#ca8a04', sort: 3 },
    { name: 'Certificate Division 4', code: 'CERT_DIV_4', division: 'Division 4', min: 200, max: 397, label: 'Average', color: '#ea580c', sort: 4 },
  ];

  for (const d of certDivisions) {
    await upsertByFilter(
      prisma.divisionRule,
      { code: d.code, curriculumVersionId: curr2024Primary.id, schoolId: null },
      {
        name: d.name, code: d.code, division: d.division,
        minScore: d.min, maxScore: d.max, label: d.label, color: d.color,
        curriculumVersionId: curr2024Primary.id, sortOrder: d.sort + 10,
      },
    );
  }

  // Selection composite divisions (best 4 + SP1 + SP2 total, 300-900 scale)
  const selDivisions = [
    { name: 'Selection Division 1', code: 'SEL_DIV_1', division: 'Division 1', min: 683, max: 900, label: 'Excellent', color: '#16a34a', sort: 1 },
    { name: 'Selection Division 2', code: 'SEL_DIV_2', division: 'Division 2', min: 623, max: 682, label: 'Very Good', color: '#2563eb', sort: 2 },
    { name: 'Selection Division 3', code: 'SEL_DIV_3', division: 'Division 3', min: 589, max: 622, label: 'Good', color: '#ca8a04', sort: 3 },
    { name: 'Selection Division 4', code: 'SEL_DIV_4', division: 'Division 4', min: 300, max: 588, label: 'Average', color: '#ea580c', sort: 4 },
  ];

  for (const d of selDivisions) {
    await upsertByFilter(
      prisma.divisionRule,
      { code: d.code, curriculumVersionId: curr2024Primary.id, schoolId: null },
      {
        name: d.name, code: d.code, division: d.division,
        minScore: d.min, maxScore: d.max, label: d.label, color: d.color,
        curriculumVersionId: curr2024Primary.id, sortOrder: d.sort + 20,
      },
    );
  }

  console.log('Division rules created');

  // ===================== 6. PERFORMANCE CATEGORIES =====================

  // ECZ Grade 7 performance categories (standardized 50-150 scale)
  const categories = [
    { name: 'One', label: 'Excellent', min: 115, max: 150, color: '#16a34a', sort: 1 },
    { name: 'Two', label: 'Very Good', min: 105, max: 114, color: '#2563eb', sort: 2 },
    { name: 'Three', label: 'Good', min: 99, max: 104, color: '#ca8a04', sort: 3 },
    { name: 'Four', label: 'Average', min: 50, max: 98, color: '#ea580c', sort: 4 },
  ];

  for (const cat of categories) {
    await upsertByFilter(
      prisma.performanceCategory,
      { name: cat.name, curriculumVersionId: curr2024Primary.id, schoolId: null },
      {
        name: cat.name, label: cat.label, minScore: cat.min, maxScore: cat.max,
        color: cat.color, curriculumVersionId: curr2024Primary.id, sortOrder: cat.sort,
      },
    );
  }

  // Composite-scale performance categories (for selection aggregate 300-900)
  const compositeCategories = [
    { name: 'One', label: 'Excellent', min: 683, max: 900, color: '#16a34a', sort: 1 },
    { name: 'Two', label: 'Very Good', min: 623, max: 682, color: '#2563eb', sort: 2 },
    { name: 'Three', label: 'Good', min: 589, max: 622, color: '#ca8a04', sort: 3 },
    { name: 'Four', label: 'Average', min: 300, max: 588, color: '#ea580c', sort: 4 },
  ];

  for (const cat of compositeCategories) {
    await upsertByFilter(
      prisma.performanceCategory,
      { name: `COMPOSITE_${cat.name}`, curriculumVersionId: curr2024Primary.id, schoolId: null },
      {
        name: `COMPOSITE_${cat.name}`, label: cat.label,
        minScore: cat.min, maxScore: cat.max,
        color: cat.color, curriculumVersionId: curr2024Primary.id, sortOrder: cat.sort + 10,
      },
    );
  }

  console.log('Performance categories created');

  // ===================== 7. ECZ GRADE 7 EXAM STRUCTURE =====================

  const grade7Stage = await prisma.academicStage.findFirst({
    where: { code: 'G7', curriculumVersionId: curr2024Primary.id },
  });

  if (grade7Stage) {
    const examStructure = await upsertByFilter(
      prisma.examStructure,
      { code: 'ECZ_G7', academicStageId: grade7Stage.id, schoolId: null },
      {
        name: 'ECZ Grade 7 National Examination',
        code: 'ECZ_G7',
        description: 'Zambia ECZ Grade 7 National Examination structure',
        academicStageId: grade7Stage.id,
        curriculumVersionId: curr2024Primary.id,
        totalMarks: 900,
        passMark: 398,
        duration: null,
      },
    );

    // Create exam components
    const components = [
      { name: 'Best Four Subjects', code: 'BEST_FOUR', maxScore: 600, weight: 1, sort: 1 },
      { name: 'Special Paper 1', code: 'SP1', maxScore: 150, weight: 1, sort: 2, isGroup: true, groupId: 'SPECIAL_PAPERS' },
      { name: 'Special Paper 2', code: 'SP2', maxScore: 150, weight: 1, sort: 3, isGroup: true, groupId: 'SPECIAL_PAPERS' },
    ];

    for (const comp of components) {
      await upsertByFilter(
        prisma.examComponent,
        { code: comp.code, examStructureId: examStructure.id, schoolId: null },
        {
          name: comp.name, code: comp.code, examStructureId: examStructure.id,
          maxScore: comp.maxScore, weight: comp.weight, sortOrder: comp.sort,
          isGroupComponent: comp.isGroup || false, groupId: comp.groupId,
        },
      );
    }

    // Link SELECTION division rules to exam structure
    const selectionDivisions = await prisma.divisionRule.findMany({
      where: { code: { startsWith: 'SEL_DIV' }, curriculumVersionId: curr2024Primary.id },
    });

    for (const dr of selectionDivisions) {
      await prisma.divisionRule.update({
        where: { id: dr.id },
        data: { examStructureId: examStructure.id },
      });
    }

    // Link certification division rules to exam structure
    const certDivs = await prisma.divisionRule.findMany({
      where: { code: { startsWith: 'CERT_DIV' }, curriculumVersionId: curr2024Primary.id },
    });

    for (const dr of certDivs) {
      await prisma.divisionRule.update({
        where: { id: dr.id },
        data: { examStructureId: examStructure.id },
      });
    }

    console.log('Grade 7 exam structure created');
  }

  // ===================== 8. CERTIFICATION RULES =====================

  await upsertByFilter(
    prisma.certificationRule,
    { code: 'ECZ_G7_CERT', curriculumVersionId: curr2024Primary.id, schoolId: null },
    {
      name: 'ECZ Grade 7 Certificate',
      code: 'ECZ_G7_CERT',
      description: 'Requirements for ECZ Grade 7 school certificate',
      minSubjects: 6, maxFailingSubjects: 0, minPassScore: 40,
      mustIncludeSubjectIds: [], minTotalScore: 200, maxTotalScore: 900,
      curriculumVersionId: curr2024Primary.id,
    },
  );

  await upsertByFilter(
    prisma.certificationRule,
    { code: 'ECZ_G12_CERT', curriculumVersionId: curr2024Secondary.id, schoolId: null },
    {
      name: 'ECZ Grade 12 School Certificate',
      code: 'ECZ_G12_CERT',
      description: 'Requirements for ECZ Grade 12 school certificate',
      minSubjects: 6, maxFailingSubjects: 0, minPassScore: 40,
      mustIncludeSubjectIds: [], minTotalScore: null, maxTotalScore: null,
      curriculumVersionId: curr2024Secondary.id,
    },
  );

  console.log('Certification rules created');

  // ===================== 9. BEST SUBJECT SELECTION RULES =====================

  await upsertByFilter(
    prisma.bestSubjectSelectionRule,
    { code: 'ECZ_G7_BEST4', curriculumVersionId: curr2024Primary.id, schoolId: null },
    {
      name: 'ECZ Grade 7 Best Four Selection',
      code: 'ECZ_G7_BEST4',
      description: 'Select best 4 subjects including English and Mathematics',
      count: 4, mustIncludeSubjectIds: [], excludeSubjectIds: [],
      curriculumVersionId: curr2024Primary.id,
    },
  );

  console.log('Best subject rules created');

  // ===================== 10. PATHWAY RULES =====================

  await upsertByFilter(
    prisma.pathwayRule,
    { code: 'STEM_PATHWAY', curriculumVersionId: curr2025Secondary.id, schoolId: null },
    {
      name: 'STEM Progression Pathway', code: 'STEM_PATHWAY',
      description: 'Science, Technology, Engineering & Mathematics track after Form 4',
      pathwayType: PathwayType.STEM, minEntryScore: 75,
      recommendedSubjects: [], compulsorySubjects: [],
      curriculumVersionId: curr2025Secondary.id,
    },
  );

  await upsertByFilter(
    prisma.pathwayRule,
    { code: 'TRADE_PATHWAY', curriculumVersionId: curr2025Secondary.id, schoolId: null },
    {
      name: 'Trade/Vocational Pathway', code: 'TRADE_PATHWAY',
      description: 'Trade and vocational skills track after Form 4',
      pathwayType: PathwayType.TRADE, minEntryScore: 50,
      recommendedSubjects: [], compulsorySubjects: [],
      curriculumVersionId: curr2025Secondary.id,
    },
  );

  console.log('Pathway rules created');
  console.log('✅ Zambian Curriculum seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
