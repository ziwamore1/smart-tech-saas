import { Client } from 'pg';

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();

  // Check current schema
  const schema = await client.query('SELECT current_schema, current_database()');
  console.log('Schema/DB:', schema.rows[0]);

  // List all tables including schema
  const tables = await client.query(
    `SELECT table_schema, table_name FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog','information_schema')
     ORDER BY table_schema, table_name`
  );
  console.log('Tables:', tables.rows.map((r: any) => `${r.table_schema}.${r.table_name}`).join(', '));

  // Check if ElementOfConstruct exists in public
  const eoc = await client.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
     WHERE table_name = 'ElementOfConstruct' AND table_schema = 'public') as exists`
  );
  console.log('ElementOfConstruct exists in public:', eoc.rows[0].exists);

  // List enum types
  const enums = await client.query(
    `SELECT t.typname FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname`
  );
  console.log('Enums:', enums.rows.map((r: any) => r.typname).join(', '));

  await client.end();
}

main().catch(console.error);
