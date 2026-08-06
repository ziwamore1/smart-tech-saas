import { PrismaClient } from '@prisma/client';
import { normalizeZambianPhone } from '../common/utils/phone.util';

const prisma = new PrismaClient();

async function backfillModel(modelName: string) {
  const model = (prisma as any)[modelName];
  const rows = await model.findMany({ where: { phone: { not: null } }, select: { id: true, phone: true } });
  let updated = 0;
  for (const row of rows) {
    const normalized = normalizeZambianPhone(row.phone);
    if (normalized && normalized !== row.phone) {
      await model.update({ where: { id: row.id }, data: { phone: normalized } });
      updated++;
    }
  }
  return { scanned: rows.length, updated };
}

async function main() {
  const models = ['user', 'parent', 'school', 'systemUser'];
  const results: Record<string, { scanned: number; updated: number }> = {};
  for (const model of models) results[model] = await backfillModel(model);
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
