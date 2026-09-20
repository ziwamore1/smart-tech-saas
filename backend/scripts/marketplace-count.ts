import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.production') });
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const [marketplace, sysDefault, certTemplates] = await Promise.all([
      prisma.templateMarketplace.count(),
      prisma.reportTemplate.count({ where: { schoolId: null, isDefault: true } }),
      prisma.reportTemplate.count({ where: { schoolId: null, templateType: 'CERTIFICATE' } }),
    ]);
    const [mkByDoc] = await prisma.$queryRaw<{ documentType: string; n: BigInt }[]>`
      SELECT "documentType"::text, COUNT(*)::bigint AS n FROM "TemplateMarketplace" GROUP BY 1 ORDER BY n DESC`;
    console.log(JSON.stringify({
      marketplaceRows: marketplace,
      systemDefaultTemplates: sysDefault,
      systemCertificateTemplates: certTemplates,
      marketplaceByDocumentType: mkByDoc.map((r) => `${r.documentType}=${r.n}`),
    }, null, 1));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((e) => { console.error('COUNTER_ERR', e.message); process.exit(1); });
