require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function main() {
  const sqlFile = path.join(__dirname, '..', 'prisma', 'migrations', '20260621000001_add_composite_subject', 'migration.sql');
  const checksum = crypto.createHash('sha256').update(fs.readFileSync(sqlFile)).digest('hex');
  const now = new Date();

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, migration_name, checksum, started_at, finished_at, applied_steps_count)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      ['a1b2c3d4-e5f6-7890-abcd-ef1234567890', '20260621000001_add_composite_subject', checksum, now, now],
    );
    console.log('Migration registered successfully');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
