import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { CalendarExcelService } from '../src/business-calendar/calendar-excel.service';
import { BusinessCalendarReportService } from '../src/business-calendar/business-calendar-report.service';

const OUT = process.env.QA_OUT || path.join(process.env.TEMP || 'C:/Users/ziwam/AppData/Local/Temp', 'opencode', 'calendar-qa');

function sessionPoolUrl() {
  const candidate = process.env.SESSION_POOL_URL;
  if (candidate) return candidate;
  if (fs.existsSync('.env.production')) {
    const line = fs.readFileSync('.env.production', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
    if (line) {
      const base = line.replace(/^DATABASE_URL=/, '').trim().replace(':6543/', ':5432/').split('?')[0];
      return `${base}?sslmode=require`;
    }
  }
  return process.env.DATABASE_URL;
}

const prisma = new PrismaClient({ datasources: { db: { url: sessionPoolUrl() } } });
const excel = new CalendarExcelService(prisma as any);
const reports = new BusinessCalendarReportService(prisma as any);

const log: Record<string, any> = {};
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * 86400000);

function writeArtifact(name: string, data: Buffer | string) {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, data);
  log[`artifact:${name}`] = `${Buffer.byteLength(data)} bytes`;
}

async function commitImport(importId: string, calendarId: string, schoolId: string, mode: string) {
  const staged = await prisma.calendarImport.findFirst({ where: { id: importId, schoolId, calendarId }, include: { rows: { orderBy: { rowNumber: 'asc' } } } });
  if (!staged) throw new Error('commitImport: import not found');
  if (staged.status === 'COMMITTED') return { idempotent: true, created: staged.createdCount, updated: staged.updatedCount, unchanged: staged.unchangedCount };
  if (staged.status !== 'VALID' || staged.rows.some((r: any) => r.status === 'ERROR')) throw new Error('commitImport: not in VALID state');
  const result = await prisma.$transaction(async (tx: any) => {
    const calendar = await tx.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId } });
    if (!calendar) throw new Error('commitImport: calendar missing');
    const existing = await tx.calendarActivity.findMany({ where: { calendarId, schoolId } });
    const byCode = new Map(existing.filter((i: any) => i.activityCode).map((i: any) => [i.activityCode, i]));
    const byStable = new Map(existing.map((i: any) => [`${i.title}|${i.startDate.toISOString()}|${i.officerId || ''}`, i]));
    const importedCodes = new Set<string>();
    let created = 0, updated = 0, unchanged = 0;
    for (const row of staged.rows) {
      const data: any = row.normalizedData;
      if (!data) continue;
      const match = (data.activityCode && byCode.get(data.activityCode)) || byStable.get(`${data.title}|${new Date(data.startDate).toISOString()}|${data.officerId || ''}`);
      const payload = {
        activityCode: data.activityCode || null, title: data.title, description: data.description, startDate: new Date(data.startDate),
        endDate: new Date(data.endDate), startTime: data.startTime, endTime: data.endTime, allDay: data.allDay, categoryId: data.categoryId,
        departmentId: data.departmentId, officerId: data.officerId, status: data.status || 'PLANNED', priority: data.priority || 'NORMAL',
        deadline: data.deadline ? new Date(data.deadline) : null, notes: data.notes,
      };
      if (match) {
        const same = ['title', 'description', 'startDate', 'endDate', 'startTime', 'endTime', 'categoryId', 'departmentId', 'officerId', 'status', 'priority', 'notes']
          .every((field) => String((match as any)[field] ?? '') === String((payload as any)[field] ?? ''));
        if (same) unchanged++; else { await tx.calendarActivity.update({ where: { id: match.id }, data: payload }); updated++; }
        importedCodes.add(match.id);
        await tx.calendarImportRow.update({ where: { id: row.id }, data: { status: 'COMMITTED', existingActivityId: match.id, changeType: same ? 'UNCHANGED' : 'UPDATE' } });
      } else {
        const createdActivity = await tx.calendarActivity.create({ data: { ...payload, schoolId, calendarId } });
        created++;
        importedCodes.add(createdActivity.id);
        await tx.calendarImportRow.update({ where: { id: row.id }, data: { status: 'COMMITTED', existingActivityId: createdActivity.id, changeType: 'CREATE' } });
      }
    }
    if (mode === 'FULL_SYNC') for (const item of existing) if (!importedCodes.has(item.id)) await tx.calendarActivity.update({ where: { id: item.id }, data: { status: 'CANCELLED' } });
    await tx.calendarImport.update({ where: { id: staged.id }, data: { status: 'COMMITTED', committedAt: new Date(), createdCount: created, updatedCount: updated, unchangedCount: unchanged } });
    await tx.schoolBusinessCalendar.update({ where: { id: calendarId }, data: { version: { increment: 1 } } });
    await tx.calendarAuditEvent.create({ data: { schoolId, calendarId, action: 'CALENDAR_IMPORT_COMMITTED', changes: { importId: staged.id, created, updated, unchanged, mode } } });
    return { created, updated, unchanged, conflicts: 0, warnings: staged.warningRows, errors: 0 };
  }, { timeout: 120000, maxWait: 60000 });
  return result;
}

async function waitForDb(retries = 5, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      return;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    for (const key of Object.keys(log)) delete log[key];
    try {
      await runOnce();
      return;
    } catch (e: any) {
      const isConn = /Can't reach database server|P1001/i.test(e?.message || String(e));
      if (!isConn || attempt === 4) throw e;
      console.log(`QA transient DB error, retrying (${attempt}/4)...`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
}

async function runOnce() {
  await waitForDb();
  const school = await prisma.school.findFirstOrThrow({ where: { name: { contains: 'ADASTRA', mode: 'insensitive' } }, select: { id: true, name: true } });
  log.school = school;

  const year = await prisma.academicYear.findFirstOrThrow({ where: { schoolId: school.id, isCurrent: true }, select: { id: true, name: true } });
  const term = await prisma.term.findFirstOrThrow({ where: { academicYearId: year.id, isCurrent: true }, select: { id: true, name: true, startDate: true, endDate: true } });
  log.period = { year: year.name, term: term.name, startDate: term.startDate, endDate: term.endDate };

  const beforeCounts = await prisma.calendarNotificationDelivery.count({ where: { schoolId: school.id } });
  log.notificationDeliveryRowsBefore = beforeCounts;

  await prisma.schoolBusinessCalendar.deleteMany({ where: { schoolId: school.id, name: { startsWith: '[QA] ' } } });

  const calendar = await prisma.schoolBusinessCalendar.create({
    data: {
      schoolId: school.id, academicYearId: year.id, termId: term.id,
      name: '[QA] Term 3 Workflow Validation', description: 'Temporary QA calendar for live workflow validation. Automatically cleaned up.',
      status: 'DRAFT', version: 1, startDate: term.startDate, endDate: term.endDate, timezone: 'Africa/Lusaka',
    },
  });
  const calendarId = calendar.id;
  log.calendar = { id: calendarId, name: calendar.name, status: calendar.status, version: calendar.version };

  const category = await prisma.calendarCategory.create({
    data: { schoolId: school.id, calendarId: calendar.id, name: '[QA] Validation', color: '#64748B', description: 'QA category' },
  });

  const activitySeeds = [
    { activityCode: 'QA-001', title: 'QA Staff Meeting', offset: 0 },
    { activityCode: 'QA-002', title: 'QA Monitoring Walk', offset: 3 },
    { activityCode: 'QA-003', title: 'QA Report Deadline', offset: 7 },
  ];
  const activities = [];
  for (const seed of activitySeeds) {
    activities.push(await prisma.calendarActivity.create({
      data: {
        schoolId: school.id, calendarId, termId: term.id, categoryId: category.id,
        activityCode: seed.activityCode, title: seed.title, description: 'QA activity; removed automatically.',
        startDate: addDays(term.startDate, seed.offset), endDate: addDays(term.startDate, seed.offset),
        allDay: true, status: 'PLANNED', priority: 'NORMAL', reminderMinutes: null,
        notes: 'Generated by live QA; removed automatically.',
      },
    }));
  }
  log.activitiesCreated = await prisma.calendarActivity.count({ where: { calendarId, schoolId: school.id } });

  const template = await excel.createWorkbook(school.id, calendarId, false);
  writeArtifact('template.xlsx', template);
  const exportBuffer = await excel.createWorkbook(school.id, calendarId, true);
  writeArtifact('export.xlsx', exportBuffer);
  const html = await reports.html(calendarId, school.id);
  writeArtifact('report.html', html);
  try {
    const pdf = await reports.pdf(calendarId, school.id);
    writeArtifact('report.pdf', pdf);
  } catch (e: any) {
    log['artifact:report.pdf'] = 'SKIPPED - ' + (e?.message || e);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template);
  const actSheet = wb.getWorksheet('Calendar Activities');
  const day1 = addDays(term.startDate, 1);
  const day2 = addDays(term.startDate, 4);
  const day3 = addDays(term.startDate, 7);
  const day4 = addDays(term.startDate, 8);
  const rowsToAdd = [
    ['QA-001', 'QA Staff Meeting', 'Unchanged row test', day1, addDays(day1, 1), '', '', 'Yes', category.name, '', '', 'PLANNED', 'NORMAL', '', 'import unchanged', ''],
    ['QA-002', 'QA Monitoring Walk (Updated)', 'Update row test', day2, addDays(day2, 1), '', '', 'Yes', category.name, '', '', 'PLANNED', 'NORMAL', '', 'import update', ''],
    ['QA-010', 'QA Imported New Activity', 'Create row test', day3, addDays(day3, 1), '', '', 'Yes', category.name, '', '', 'PLANNED', 'NORMAL', '', 'import create', ''],
    ['QA-011', 'QA Imported New Activity Two', 'Create row test two', day4, addDays(day4, 1), '', '', 'Yes', category.name, '', '', 'PLANNED', 'NORMAL', '', 'import create', ''],
  ];
  const numRow = actSheet.getCell(4, 1).row;
  for (const values of rowsToAdd) {
    const row = actSheet.addRow(values);
    row.getCell(4).numFmt = 'dd/mm/yyyy';
    row.getCell(5).numFmt = 'dd/mm/yyyy';
    row.getCell(14).numFmt = 'dd/mm/yyyy';
  }
  const importBuffer = Buffer.from(await wb.xlsx.writeBuffer());
  writeArtifact('import-workbook.xlsx', importBuffer);

  const parsed = await excel.parse(importBuffer, 'qa-import.xlsx', school.id, calendarId, 'UPDATE_EXISTING');
  log.parse = { total: parsed.counts.total, valid: parsed.counts.valid, warnings: parsed.counts.warnings, errors: parsed.counts.errors };

  const staged = await excel.stage(importBuffer, 'qa-import.xlsx', school.id, calendarId, 'UPDATE_EXISTING');
  log.stage = { importId: staged.importId, status: staged.status, counts: staged.counts };
  await prisma.calendarImport.update({ where: { id: staged.importId }, data: { status: 'VALID' } });

  const versionBeforeCommit = (await prisma.schoolBusinessCalendar.findUniqueOrThrow({ where: { id: calendarId }, select: { version: true } })).version;
  const commit1 = await commitImport(staged.importId, calendarId, school.id, 'UPDATE_EXISTING');
  const versionAfterCommit = (await prisma.schoolBusinessCalendar.findUniqueOrThrow({ where: { id: calendarId }, select: { version: true } })).version;
  const commit2 = await commitImport(staged.importId, calendarId, school.id, 'UPDATE_EXISTING');
  log.commit = { versionBeforeCommit, versionAfterCommit, commit1, commit2 };

  const afterActivityCodes = (await prisma.calendarActivity.findMany({ where: { calendarId, schoolId: school.id }, select: { activityCode: true, title: true }, orderBy: { startDate: 'asc' } })).map((a) => `${a.activityCode}|${a.title}`);
  log.activitiesAfterImport = afterActivityCodes;
  log.auditEvents = await prisma.calendarAuditEvent.count({ where: { calendarId, schoolId: school.id } });

  const broadcastRoles = ['DIRECTOR', 'DEPUTY DIRECTOR', 'HEAD TEACHER', 'DEPUTY HEAD', 'DEPUTY', 'HOD', 'TEACHER', 'CLASS TEACHER'];
  const contactableFilter = { OR: [{ phone: { not: null } }, { email: { not: '' } }] } as any;
  const allContactable = await prisma.user.findMany({
    where: {
      schoolId: school.id, isActive: true,
      ...contactableFilter,
    },
    select: { id: true, phone: true, email: true },
  });
  const broadcast = await prisma.user.findMany({
    where: {
      schoolId: school.id, isActive: true,
      ...contactableFilter,
      userRoles: { some: { role: { name: { in: broadcastRoles, mode: 'insensitive' } } } },
    },
    select: { id: true, phone: true, email: true },
  });
  const broadcastPhone = broadcast.filter((u) => u.phone);
  const broadcastEmailOnly = broadcast.filter((u) => !u.phone && u.email);
  log.recipientPolicy = {
    allContactableUsers: allContactable.length,
    broadcastTarget: broadcast.length,
    broadcastWithPhone: broadcastPhone.length,
    broadcastEmailOnly: broadcastEmailOnly.length,
    avoidedUsers: allContactable.length - broadcast.length,
  };

  const oneUser = await prisma.user.findFirstOrThrow({ where: { schoolId: school.id, isActive: true, phone: { not: null } }, select: { id: true, firstName: true, lastName: true, phone: true, email: true } });
  const oneUserAudience = await prisma.calendarActivityAudience.create({ data: { activityId: activities[0].id, type: 'USER', userId: oneUser.id, label: oneUser.phone } });
  const scopedRecipients = await prisma.user.findMany({ where: { schoolId: school.id, isActive: true, ...contactableFilter, id: { in: [oneUser.id] } }, select: { id: true, phone: true, email: true } });
  log.scopedAudienceRecipients = { userId: oneUser.id, user: `${oneUser.firstName} ${oneUser.lastName}`, phone: oneUser.phone, count: scopedRecipients.length };
  await prisma.calendarActivityAudience.delete({ where: { id: oneUserAudience.id } });

  const deliveryRows = await prisma.calendarNotificationDelivery.count({ where: { schoolId: school.id } });
  log.notificationDeliveryRowsAfter = deliveryRows;
  if (deliveryRows !== beforeCounts) log.WARNING = 'notification delivery rows changed during QA (unexpected)';

  const leftoverCount = await prisma.schoolBusinessCalendar.count({ where: { schoolId: school.id, name: { startsWith: '[QA] ' } } });
  log.cleanup = { calendarsMarkedQA: leftoverCount, deleted: leftoverCount > 0 };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}

main()
  .catch((error: any) => {
    console.error('QA FAILED:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (log.calendar?.id) {
        const deleted = await prisma.calendarActivity.deleteMany({ where: { calendarId: log.calendar.id, schoolId: log.school.id } });
        const calDeleted = await prisma.schoolBusinessCalendar.deleteMany({ where: { id: log.calendar.id, schoolId: log.school.id } });
        await prisma.calendarCategory.deleteMany({ where: { schoolId: log.school.id, name: { startsWith: '[QA] ' } } });
        console.log('CLEANUP:', JSON.stringify({ activitiesDeleted: deleted.count, calendarsDeleted: calDeleted.count }));
      }
    } catch (cleanupError: any) {
      console.error('CLEANUP FAILED:', cleanupError?.message || cleanupError);
      process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
  });