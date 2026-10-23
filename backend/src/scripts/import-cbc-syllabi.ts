import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const root = path.resolve(process.cwd(), '..');

const syllabusFiles: Array<{ file: string; code: string; name: string }> = [
  { file: 'AGRICULTURAL-SCIENCE-O-LEVEL-SYLLABUS-FORM-1-4.pdf', code: '4018', name: 'Agricultural Science' },
  { file: 'CAMERA-READY-O-LEVEL-BIOLOGY-SYLABUS-5-02-2024-FINAL-CORRECTED-FOR-PRINTING.pdf', code: '4012', name: 'Biology' },
  { file: 'CAMERA-READY-O-LEVEL-LITERATURE-IN-ENGLISH-SYLABUS-5-02-2024-FINAL-CORRECTED-FOR-PRINTING.pdf', code: '1025', name: 'Literature in English' },
  { file: 'CHEMISTRY-SYLLABUS.pdf', code: '4014', name: 'Chemistry' },
  { file: 'CIVIC-EDUCATION-SYLLABUS-SCIENCE-O-LEVEL-SYLLABUS-FORM-1-4.pdf', code: '3011', name: 'Civic Education' },
  { file: 'COMMERCE-AND-PRINCIPLES-OF-ACCOUNTS-SYLABUS-CAMERA-READY-O-LEVEL-FORM-1-4.pdf', code: '7015', name: 'Commerce' },
  { file: 'DESIGN-AND-TECHNOLOGY-STUDIES-5-02-2024-FINAL-CORRECTED-FOR-PRINTING.pdf', code: '8015', name: 'Design and Technology' },
  { file: 'FASHION-AND-FABRICS-SYLABUS-CAMERA-READY-O-LEVEL-FORM-1-4.pdf', code: '6012', name: 'Fashion and Fabrics' },
  { file: 'Final-O-LEVEL-MATH-1-4-final.pdf', code: '2021', name: 'Mathematics I' },
  { file: 'FOOD-AND-NUTRITION-SYLLABUS-FINAL-07-02-2024.pdf', code: '6014', name: 'Food and Nutrition' },
  { file: 'GEOGRAPHY-SYLLABUS-5-02-2024-FINAL-CORRECTED-FOR-PRINTING.pdf', code: '3014', name: 'Geography' },
  { file: 'HISTORY-SYLLABUS-FORMS-1-4.pdf', code: '3013', name: 'History' },
  { file: 'PHYSICS-SYLLABUS-O-LEVEL-FORM-1-4-CAMERA-READY.pdf', code: '4016', name: 'Physics' },
];

function clean(value: string) {
  return value.replace(/[.\u0000-\u001f]+$/g, '').replace(/\s+/g, ' ').trim();
}

function formFromCode(code: string) {
  const first = Number(code.split('.')[0]);
  return first >= 1 && first <= 4 ? first : undefined;
}

function depth(code: string) {
  return code.split('.').length;
}

async function extract(filePath: string) {
  // pdf-parse v2 loads browser canvas globals during module initialisation.
  // Text extraction does not need rendering, so lightweight globals are enough.
  const globals = globalThis as any;
  globals.DOMMatrix ||= class {};
  globals.Path2D ||= class {};
  globals.ImageData ||= class {};
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: fs.readFileSync(filePath) });
  const result = await parser.getText();
  return result.text;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const school = dryRun ? null : await prisma.school.findFirst({ where: { name: { contains: 'Demo' } } })
    || await prisma.school.findFirst();
  if (!dryRun && !school) throw new Error('Create a school before importing CBC syllabi');

  const assessmentPath = path.join(root, 'Competence Based Curriculum Assessment Guideline (CBC)', 'ECSEOL Assessment Schemes_22_4_2026.pdf');
  if (!dryRun && fs.existsSync(assessmentPath)) {
    await prisma.syllabusDocument.upsert({
      where: { id: 'cbc-assessment-guideline-2026' },
      update: { filePath: path.relative(process.cwd(), assessmentPath), isProcessed: false },
      create: {
        id: 'cbc-assessment-guideline-2026', title: 'ECZ CBC Assessment Guideline 2026',
        documentType: 'ASSESSMENT_GUIDELINE', curriculum: 'ECZ',
        filePath: path.relative(process.cwd(), assessmentPath), fileType: 'application/pdf', schoolId: school.id,
      },
    });
  }

  for (const item of syllabusFiles) {
    const filePath = path.join(root, 'CBC_SYLLABI', item.file);
    if (!fs.existsSync(filePath)) throw new Error(`Missing syllabus: ${filePath}`);
    const text = await extract(filePath);
    const rows = [...text.matchAll(/(?:^|\n)\s*(\d+(?:\.\d+)+)\s+([^\n]+)/g)];
    if (dryRun) {
      console.log(`${item.name}: ${rows.length} numbered rows detected${rows.length === 0 ? ' (needs OCR/font decoding)' : ''}`);
      continue;
    }
    const subject = await prisma.subject.findFirst({ where: { schoolId: school!.id, code: item.code } });
    if (!subject) throw new Error(`Subject ${item.name} (${item.code}) is not seeded for this school`);
    const document = await prisma.syllabusDocument.upsert({
      where: { id: `cbc-syllabus-${item.code}` },
      update: { filePath: path.relative(process.cwd(), filePath), fileSize: fs.statSync(filePath).size, isProcessed: rows.length > 0, metadata: { source: 'CBC_SYLLABI', extractedAt: new Date().toISOString(), extractedRows: rows.length } },
      create: {
        id: `cbc-syllabus-${item.code}`, title: `${item.name} CBC Syllabus Form 1-4`, documentType: 'SYLLABUS', curriculum: 'ECZ',
        filePath: path.relative(process.cwd(), filePath), fileSize: fs.statSync(filePath).size, fileType: 'application/pdf', isProcessed: rows.length > 0,
        metadata: { source: 'CBC_SYLLABI', extractedAt: new Date().toISOString(), extractedRows: rows.length }, schoolId: school!.id,
      },
    });
    if (rows.length === 0) {
      console.warn(`${item.name}: no numbered syllabus rows detected; source document retained for OCR/font-aware extraction`);
      continue;
    }

    // Numbered syllabus rows are retained verbatim. Follow-up enrichment can
    // replace text-only rows with table-cell extraction without losing source auditability.
    let currentTopic = '';
    let currentSubtopic: string | undefined;
    for (const [index, match] of rows.entries()) {
      const code = match[1];
      const label = clean(match[2]);
      if (!label || label.length > 300) continue;
      const codeDepth = depth(code);
      if (codeDepth === 2) { currentTopic = label; currentSubtopic = undefined; }
      else if (codeDepth === 3) currentSubtopic = label;
      if (!currentTopic) continue;
      const form = formFromCode(code);
      let topicRecord = await prisma.topic.findFirst({ where: { name: currentTopic, subjectId: subject.id, academicStageId: null } });
      if (!topicRecord) {
        topicRecord = await prisma.topic.create({ data: { name: currentTopic, code: code.split('.').slice(0, 2).join('.'), description: `CBC syllabus unit ${code.split('.').slice(0, 2).join('.')}`, subjectId: subject.id, sortOrder: Number(code.split('.')[1]) || index, schoolId: school.id } });
      }
      let subtopicRecord: { id: string } | undefined;
      if (currentSubtopic) {
        subtopicRecord = await prisma.subtopic.upsert({
          where: { name_topicId: { name: currentSubtopic, topicId: topicRecord.id } },
          update: { code: codeDepth === 3 ? code : undefined, sortOrder: Number(code.split('.')[2]) || index },
          create: { name: currentSubtopic, code: code.split('.').slice(0, 3).join('.'), topicId: topicRecord.id, sortOrder: Number(code.split('.')[2]) || index, schoolId: school.id },
        });
      }
      if (codeDepth >= 4) {
        await prisma.competency.upsert({
          where: { name_topicId_subjectId: { name: label, topicId: topicRecord.id, subjectId: subject.id } },
          update: { code, subtopicId: subtopicRecord?.id, description: `CBC competency ${code}` },
          create: { name: label, code, topicId: topicRecord.id, subtopicId: subtopicRecord?.id, subjectId: subject.id, description: `CBC competency ${code}`, schoolId: school.id },
        });
      }
      await prisma.syllabusEntry.upsert({
        where: { id: `cbc-entry-${item.code}-${index}` },
        update: { topic: currentTopic, subtopic: currentSubtopic, competencyCode: codeDepth >= 4 ? code : null, competency: codeDepth >= 4 ? label : null, rawText: match[0], formNumber: form },
        create: { id: `cbc-entry-${item.code}-${index}`, documentId: document.id, subjectId: subject.id, topic: currentTopic, subtopic: currentSubtopic, competencyCode: codeDepth >= 4 ? code : null, competency: codeDepth >= 4 ? label : null, rawText: match[0], formNumber: form, unitCode: codeDepth === 2 ? code : code.split('.').slice(0, 2).join('.'), subUnitCode: codeDepth >= 3 ? code : null },
      });
    }
    await prisma.syllabusDocument.update({ where: { id: document.id }, data: { metadata: { source: 'CBC_SYLLABI', extractedRows: rows.length } } });
    console.log(`${item.name}: ${rows.length} numbered rows imported`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
