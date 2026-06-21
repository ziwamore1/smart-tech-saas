require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', '20260621000001_add_composite_subject', 'migration.sql'),
    'utf-8',
  );

  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/school_saas',
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Split by semicolons and execute each statement
    const rawStatements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    const statements = rawStatements
      .map(s => s.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.query(stmt + ';');
        console.log(`OK: ${stmt.substring(0, 80)}...`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.code === '42710' || err.message?.includes('already exists')) {
          console.log(`SKIP (already exists): ${stmt.substring(0, 80)}...`);
        } else {
          throw err;
        }
      }
    }

    console.log('Migration complete!');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});