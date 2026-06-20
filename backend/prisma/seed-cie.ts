import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const subjects = [
  { code: '1021', name: 'English Language' },
  { code: '1025', name: 'Literature in English' },
  { code: '3011', name: 'Civic Education' },
  { code: '3012', name: 'Religious Education' },
  { code: '3013', name: 'History' },
  { code: '3014', name: 'Geography' },
  { code: '1120', name: 'French Language' },
  { code: '1125', name: 'Chinese Language' },
  { code: '1211', name: 'Zambian Languages' },
  { code: '2021', name: 'Mathematics I' },
  { code: '2025', name: 'Mathematics II' },
  { code: '4018', name: 'Agricultural Science' },
  { code: '4016', name: 'Physics' },
  { code: '4014', name: 'Chemistry' },
  { code: '4012', name: 'Biology' },
  { code: '5012', name: 'Art and Design' },
  { code: '5014', name: 'Musical Arts' },
  { code: '8015', name: 'Design and Technology' },
  { code: '6012', name: 'Fashion and Fabrics' },
  { code: '6014', name: 'Food and Nutrition' },
  { code: '6015', name: 'Hospitality Management' },
  { code: '6016', name: 'Travel and Tourism' },
  { code: '9010', name: 'Physical Education and Sport' },
  { code: '8010', name: 'Computer Science' },
  { code: '8011', name: 'Information and Communications Technology' },
  { code: '7015', name: 'Commerce' },
  { code: '7020', name: 'Principles of Accounts' },
];

const eocs: Record<string, { name: string; construct: string }[]> = {
  'English Language': [
    { name: 'Interprets and understands spoken information', construct: 'Listening comprehension' },
    { name: 'Produces ideas, thoughts and opinions through spoken language', construct: 'Speaking production' },
    { name: 'Reads, Interprets and summarises continuous and non-continuous texts', construct: 'Reading comprehension' },
    { name: 'Demonstrates masterly of written language conventions', construct: 'Writing production' },
  ],
  'Literature in English': [
    { name: 'Demonstrates knowledge of literary devices, themes and characterisation', construct: 'Literary analysis' },
    { name: 'Analyzes and interprets prose, poetry and drama', construct: 'Textual analysis' },
    { name: 'Critically evaluates literary works in their social and historical contexts', construct: 'Critical evaluation' },
    { name: 'Produces coherent and well-structured critical essays', construct: 'Written expression' },
  ],
  'Civic Education': [
    { name: 'Demonstrates understanding of governance, democracy and human rights', construct: 'Governance and rights' },
    { name: 'Analyzes the role of citizens in national development', construct: 'Citizenship' },
    { name: 'Evaluates the importance of rule of law and constitutionalism', construct: 'Rule of law' },
    { name: 'Applies civic knowledge to real-life situations', construct: 'Civic application' },
  ],
  'Religious Education': [
    { name: 'Demonstrates knowledge of major world religions and their teachings', construct: 'Religious knowledge' },
    { name: 'Analyzes moral and ethical issues from religious perspectives', construct: 'Moral reasoning' },
    { name: 'Evaluates the role of religion in society', construct: 'Religion and society' },
    { name: 'Applies religious principles to contemporary issues', construct: 'Practical application' },
  ],
  'History': [
    { name: 'Demonstrates knowledge of historical events, periods and personalities', construct: 'Historical knowledge' },
    { name: 'Analyzes causes and effects of historical events', construct: 'Historical analysis' },
    { name: 'Evaluates historical sources and interpretations', construct: 'Source evaluation' },
    { name: 'Constructs coherent historical arguments', construct: 'Historical writing' },
  ],
  'Geography': [
    { name: 'Demonstrates understanding of physical geography processes and landforms', construct: 'Physical geography' },
    { name: 'Analyzes human geography patterns and their interrelationships', construct: 'Human geography' },
    { name: 'Interprets and constructs maps, graphs and diagrams', construct: 'Cartographic skills' },
    { name: 'Evaluates environmental management and sustainability issues', construct: 'Environmental management' },
  ],
  'Mathematics I': [
    { name: 'Demonstrates understanding of number concepts and operations', construct: 'Number' },
    { name: 'Applies algebraic techniques to solve problems', construct: 'Algebra' },
    { name: 'Demonstrates understanding of geometry and measurement', construct: 'Geometry and measurement' },
    { name: 'Collects, represents and interprets data', construct: 'Statistics and probability' },
  ],
  'Mathematics II': [
    { name: 'Demonstrates advanced algebraic manipulation and problem-solving', construct: 'Advanced algebra' },
    { name: 'Applies trigonometric concepts to solve problems', construct: 'Trigonometry' },
    { name: 'Demonstrates understanding of calculus concepts', construct: 'Calculus' },
    { name: 'Applies mathematical reasoning to real-world contexts', construct: 'Mathematical application' },
  ],
  'Physics': [
    { name: 'Demonstrates understanding of mechanics and motion', construct: 'Mechanics' },
    { name: 'Applies principles of waves, light and sound', construct: 'Waves' },
    { name: 'Demonstrates knowledge of electricity and magnetism', construct: 'Electricity and magnetism' },
    { name: 'Applies experimental and investigative skills', construct: 'Practical physics' },
  ],
  'Chemistry': [
    { name: 'Demonstrates understanding of atomic structure and bonding', construct: 'Atomic structure' },
    { name: 'Applies principles of chemical reactions and equations', construct: 'Chemical reactions' },
    { name: 'Demonstrates knowledge of organic chemistry and functional groups', construct: 'Organic chemistry' },
    { name: 'Applies experimental and analytical chemistry skills', construct: 'Practical chemistry' },
  ],
  'Biology': [
    { name: 'Demonstrates understanding of cell biology and genetics', construct: 'Cell biology and genetics' },
    { name: 'Analyzes structure and function of living organisms', construct: 'Organismal biology' },
    { name: 'Demonstrates knowledge of ecology and environmental biology', construct: 'Ecology' },
    { name: 'Applies scientific inquiry and experimental skills', construct: 'Practical biology' },
  ],
  'Computer Science': [
    { name: 'Demonstrates understanding of computer systems and architecture', construct: 'Computer systems' },
    { name: 'Applies algorithmic thinking and programming concepts', construct: 'Programming' },
    { name: 'Demonstrates knowledge of data structures and databases', construct: 'Data management' },
    { name: 'Evaluates social, ethical and security implications of computing', construct: 'Social implications' },
  ],
  'Commerce': [
    { name: 'Demonstrates understanding of business structures and trade', construct: 'Business and trade' },
    { name: 'Analyzes marketing, finance and economic principles', construct: 'Business operations' },
    { name: 'Evaluates the role of money, banking and financial institutions', construct: 'Finance and banking' },
    { name: 'Applies commercial knowledge to business scenarios', construct: 'Commercial application' },
  ],
  'Principles of Accounts': [
    { name: 'Demonstrates understanding of accounting principles and concepts', construct: 'Accounting fundamentals' },
    { name: 'Prepares and interprets financial statements', construct: 'Financial statements' },
    { name: 'Applies accounting techniques to partnerships and companies', construct: 'Advanced accounting' },
    { name: 'Analyzes and interprets accounting information for decision-making', construct: 'Interpretation and analysis' },
  ],
};

const assessmentObjectives: Record<string, { name: string; weight: number }[]> = {
  'English Language': [
    { name: 'Listening comprehension', weight: 15 },
    { name: 'Speaking production', weight: 15 },
    { name: 'Reading comprehension and summary', weight: 30 },
    { name: 'Composition and writing conventions', weight: 40 },
  ],
};

async function main() {
  let school = await prisma.school.findFirst({ where: { name: { contains: 'Demo' } } });
  if (!school) {
    school = await prisma.school.findFirst();
  }
  if (!school) {
    console.log('No school found, creating default school...');
    school = await prisma.school.create({
      data: { name: 'Demo International School', subscriptionStatus: 'active', subscriptionTier: 'enterprise' },
    });
  }
  const schoolId = school.id;

  const existingSubjects = await prisma.subject.findMany({ where: { schoolId } });
  const existingCodes = new Map(existingSubjects.map(s => [s.code, s]));

  for (const sub of subjects) {
    let subjectId = existingCodes.get(sub.code)?.id;
    if (!subjectId) {
      const created = await prisma.subject.create({
        data: { name: sub.name, code: sub.code, schoolId },
      });
      subjectId = created.id;
      console.log(`Created subject: ${sub.name} (${sub.code})`);
    } else {
      console.log(`Subject already exists: ${sub.name} (${sub.code})`);
    }

    const subjectEocs = eocs[sub.name] || [];
    for (const eoc of subjectEocs) {
      const existing = await prisma.elementOfConstruct.findFirst({
        where: { name: eoc.name, subjectId },
      });
      if (!existing) {
        await prisma.elementOfConstruct.create({
          data: { name: eoc.name, construct: eoc.construct, subjectId, sortOrder: subjectEocs.indexOf(eoc) + 1, schoolId },
        });
        console.log(`  Created EoC: ${eoc.name}`);
      }
    }

    const subjectAos = assessmentObjectives[sub.name] || [];
    for (const ao of subjectAos) {
      const existing = await prisma.assessmentObjective.findFirst({
        where: { name: ao.name, subjectId },
      });
      if (!existing) {
        await prisma.assessmentObjective.create({
          data: { name: ao.name, weight: ao.weight, subjectId, schoolId },
        });
        console.log(`  Created AO: ${ao.name} (${ao.weight}%)`);
      }
    }
  }

  const doc = await prisma.syllabusDocument.findFirst({
    where: { title: 'ECZ Assessment Schemes 2026' },
  });
  if (!doc) {
    await prisma.syllabusDocument.create({
      data: {
        title: 'ECZ Assessment Schemes 2026',
        documentType: 'ASSESSMENT_SCHEME',
        curriculum: 'ECZ',
        filePath: 'uploads/library/ecseol_text.txt',
        fileType: 'text/plain',
        schoolId,
      },
    });
    console.log('Created SyllabusDocument: ECZ Assessment Schemes 2026');
  }

  console.log('\nSeed complete! 28 subjects, EoCs and AOs populated.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
