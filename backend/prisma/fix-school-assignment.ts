import { Client } from 'pg';

let client: Client;

async function q(text: string, params?: any[]) {
  return client.query(text, params);
}

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  const realSchoolId = '3d439fb7-1d33-4291-b150-7dea9935042c';

  const demo = await q(`SELECT id FROM "School" WHERE name = 'Demo International School' LIMIT 1`);
  if (demo.rows.length === 0) {
    console.log('No demo school found. Checking existing CIE data...');
    const existing = await q(`SELECT COUNT(*) FROM "Subject" WHERE "schoolId" = $1`, [realSchoolId]);
    console.log(`Subjects for real school: ${existing.rows[0].count}`);
    return;
  }

  const demoId = demo.rows[0].id;
  console.log(`Demo school ID: ${demoId}`);

  const demoSubjects = await q(`SELECT id, name, code FROM "Subject" WHERE "schoolId" = $1`, [demoId]);
  console.log(`Demo subjects: ${demoSubjects.rows.length}`);

  const existingSubjects = await q(`SELECT code FROM "Subject" WHERE "schoolId" = $1`, [realSchoolId]);
  const existingCodes = new Set(existingSubjects.rows.map((r: any) => r.code));

  for (const sub of demoSubjects.rows) {
    if (existingCodes.has(sub.code)) {
      console.log(`Subject ${sub.name} (${sub.code}) already exists for real school, skipping`);
      continue;
    }

    const newSub = await q(
      `INSERT INTO "Subject" (id, name, code, "schoolId") VALUES (gen_random_uuid(), $1, $2, $3) RETURNING id`,
      [sub.name, sub.code, realSchoolId]
    );
    const newSubjectId = newSub.rows[0].id;
    console.log(`Created subject ${sub.name} (${sub.code}) -> ${newSubjectId}`);

    const eocs = await q(`SELECT * FROM "ElementOfConstruct" WHERE "subjectId" = $1`, [sub.id]);
    for (const eoc of eocs.rows) {
      await q(
        `INSERT INTO "ElementOfConstruct" (id, name, code, description, "sortOrder", "subjectId", construct, "isActive", "schoolId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [eoc.name, eoc.code, eoc.description, eoc.sortOrder, newSubjectId, eoc.construct, true, realSchoolId]
      );
      console.log(`  Copied EoC: ${eoc.name}`);
    }

    const aos = await q(`SELECT * FROM "AssessmentObjective" WHERE "subjectId" = $1`, [sub.id]);
    for (const ao of aos.rows) {
      await q(
        `INSERT INTO "AssessmentObjective" (id, name, code, description, weight, "subjectId", "isActive", "schoolId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [ao.name, ao.code, ao.description, ao.weight, newSubjectId, true, realSchoolId]
      );
      console.log(`  Copied AO: ${ao.name}`);
    }

    const docSubs = await q(`SELECT * FROM "SyllabusDocumentSubject" WHERE "subjectId" = $1`, [sub.id]);
    for (const ds of docSubs.rows) {
      await q(
        `INSERT INTO "SyllabusDocumentSubject" (id, "documentId", "subjectId", "subjectCode", construct, "sbaWeight", "examWeight", "sbaTasks", "examItems", metadata, "schoolId")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [ds.documentId, newSubjectId, ds.subjectCode, ds.construct, ds.sbaWeight, ds.examWeight, ds.sbaTasks, ds.examItems, ds.metadata, realSchoolId]
      );
    }
  }

  await q(`UPDATE "SyllabusDocument" SET "schoolId" = $1 WHERE "schoolId" = $2`, [realSchoolId, demoId]);
  console.log('Updated SyllabusDocument school');

  await q(`DELETE FROM "CurriculumCoverage" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "CurriculumLessonPlanActivity" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "CurriculumLessonPlan" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "SbaTask" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "SyllabusDocumentSubject" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "SyllabusDocument" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "AssessmentObjective" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "LearningOutcome" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "ElementOfConstruct" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "Competency" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "Subtopic" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "Topic" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "Subject" WHERE "schoolId" = $1`, [demoId]);
  await q(`DELETE FROM "School" WHERE id = $1`, [demoId]);

  console.log('Done! CIE data now belongs to SMART TECH SECONDARY SCHOOL');
}

main().catch(console.error).finally(() => client?.end().catch(() => {}));
