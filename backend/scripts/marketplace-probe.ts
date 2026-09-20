import * as dotenv from 'dotenv';
import * as path from 'node:path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.production') });
import { PrismaClient } from '@prisma/client';

async function main() {
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        (SELECT COUNT(*) FROM "TemplateMarketplace")::int AS marketplace_rows,
        (SELECT COUNT(*) FROM "ReportTemplate" WHERE "schoolId" IS NULL AND "isDefault" = true)::int AS system_default_templates,
        (SELECT COUNT(*) FROM "ReportTemplate" WHERE "schoolId" IS NULL)::int AS system_any_templates
    `);
    const byDoc = await db.$queryRawUnsafe<Array<{ documentType: string | null; n: number }>>(`
      SELECT COALESCE("documentType"::text, '(null)') AS "documentType", COUNT(*)::int AS n
      FROM "TemplateMarketplace" GROUP BY 1 ORDER BY 2 DESC
    `);
    console.log('MPROBE ' + JSON.stringify({ ...rows[0], byDocumentType: byDoc }));
  } catch (e) {
    console.log('MPROBE_ERR ' + (e as Error).message);
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
main();
