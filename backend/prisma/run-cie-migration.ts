import { Client } from 'pg';
import * as fs from 'fs';

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  let sql = fs.readFileSync(
    'prisma/migrations/20260620000001_add_curriculum_intelligence_engine/migration.sql',
    'utf-8'
  );

  // Remove comment lines
  sql = sql.replace(/^--.*$/gm, '').trim();

  // Split by semicolons and filter empty
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Executing ${statements.length} SQL statements...`);
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    try {
      await client.query(stmt);
      console.log(`  [${i + 1}/${statements.length}] OK`);
    } catch (err: any) {
      if (err.code === '42710' || err.message?.includes('already exists')) {
        console.log(`  [${i + 1}/${statements.length}] SKIP (already exists)`);
      } else {
        console.error(`  [${i + 1}/${statements.length}] ERROR: ${err.message}`);
        console.error(`  Statement: ${stmt.substring(0, 120)}...`);
      }
    }
  }

  // Record migration in _prisma_migrations
  const migrationName = '20260620000001_add_curriculum_intelligence_engine';
  const checksum = '0000000000000000000000000000000000000000000000000000000000000000';
  
  await client.query(
    `INSERT INTO _prisma_migrations (id, migration_name, checksum, started_at, finished_at)
     VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
     ON CONFLICT DO NOTHING`,
    [migrationName, checksum]
  );
  console.log(`\nRecorded migration ${migrationName} in _prisma_migrations`);

  // Verify CIE tables exist
  const cieTables = ['Topic', 'Subtopic', 'Competency', 'ElementOfConstruct', 
    'LearningOutcome', 'AssessmentObjective', 'SyllabusDocument', 
    'SyllabusDocumentSubject', 'SbaTask', 'CurriculumLessonPlan',
    'CurriculumLessonPlanActivity', 'CurriculumCoverage'];
  
  let missing = 0;
  for (const tbl of cieTables) {
    const result = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = 'public') as exists`,
      [tbl]
    );
    if (result.rows[0].exists) {
      console.log(`  EXISTS: ${tbl}`);
    } else {
      console.log(`  MISSING: ${tbl}`);
      missing++;
    }
  }

  console.log(`\n${missing === 0 ? 'All CIE tables created successfully!' : `${missing} tables still missing!`}`);
  await client.end();
}

main().catch(console.error);
