import { Client } from 'pg';

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  const migrations = await client.query(
    `SELECT migration_name, started_at, finished_at FROM _prisma_migrations ORDER BY started_at`
  );
  console.log('Applied migrations:');
  for (const row of migrations.rows) {
    console.log(`  ${row.migration_name} started=${row.started_at} finished=${row.finished_at}`);
  }

  // Check for CIE tables specifically
  const cieTables = ['Topic', 'Subtopic', 'Competency', 'ElementOfConstruct', 
    'LearningOutcome', 'AssessmentObjective', 'SyllabusDocument', 
    'SyllabusDocumentSubject', 'SbaTask', 'CurriculumLessonPlan',
    'CurriculumLessonPlanActivity', 'CurriculumCoverage'];
  
  for (const tbl of cieTables) {
    const result = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public') as exists`,
      [tbl]
    );
    if (!result.rows[0].exists) {
      console.log(`  MISSING: ${tbl}`);
    }
  }

  const subjectCount = await client.query('SELECT COUNT(*) FROM "Subject"');
  console.log(`\nTotal subjects: ${subjectCount.rows[0].count}`);

  await client.end();
}

main().catch(console.error);
