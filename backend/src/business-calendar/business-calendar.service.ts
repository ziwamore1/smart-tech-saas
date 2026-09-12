import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClassAccessService } from '../common/access/class-access.service';
import { PERMISSIONS } from '../common/access/permission-registry';
import { CalendarExcelService } from './calendar-excel.service';
import { SchoolEventsGateway } from '../common/school-events.gateway';
import { CacheService } from '../common/services/cache.service';
import { BusinessCalendarNotificationService } from './business-calendar-notification.service';

type Actor = { id: string; schoolId?: string | null; isSuperAdmin?: boolean; roles?: string[] };

@Injectable()
export class BusinessCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClassAccessService,
    private readonly excel: CalendarExcelService,
    private readonly events: SchoolEventsGateway,
    private readonly cache: CacheService,
    private readonly notifications: BusinessCalendarNotificationService,
  ) {}

  private schoolId(actor: Actor, requested?: string) {
    const schoolId = actor.schoolId || requested;
    if (!schoolId) throw new ForbiddenException('No school context is active');
    return schoolId;
  }

  private async assertPermission(actor: Actor, permission: string) {
    if (actor.isSuperAdmin) return;
    const permissions = await this.access.getPermissions(actor);
    if (!permissions.includes(permission as any)) throw new ForbiddenException('You do not have calendar permission');
  }

  private date(value: unknown, field: string): Date {
    const result = new Date(String(value));
    if (!value || Number.isNaN(result.getTime())) throw new BadRequestException(`Invalid ${field}`);
    return result;
  }

  private validateRange(start: Date, end: Date) {
    if (end < start) throw new BadRequestException('endDate must be on or after startDate');
  }

  private async schoolReferences(schoolId: string, data: any) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: data.academicYearId, schoolId } });
    if (!year) throw new BadRequestException('Academic year does not belong to this school');
    if (data.termId) {
      const term = await this.prisma.term.findFirst({ where: { id: data.termId, academicYearId: year.id } });
      if (!term) throw new BadRequestException('Term does not belong to this academic year');
    }
  }

  private async calendar(id: string, schoolId: string) {
    const calendar = await this.prisma.schoolBusinessCalendar.findFirst({ where: { id, schoolId } });
    if (!calendar) throw new NotFoundException('Calendar not found');
    return calendar;
  }

  private async activity(id: string, schoolId: string) {
    const activity = await this.prisma.calendarActivity.findFirst({ where: { id, schoolId } });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  private async audit(actor: Actor, schoolId: string, action: string, model: string, recordId: string, changes?: any) {
    await this.prisma.calendarAuditEvent.create({ data: { schoolId, calendarId: model === 'SchoolBusinessCalendar' ? recordId : undefined, userId: actor.isSuperAdmin ? undefined : actor.id, action, changes } });
    if (!actor.isSuperAdmin) {
      await this.prisma.auditLog.create({ data: { userId: actor.id, schoolId, action, model, recordId, changes } });
    }
    this.cache.invalidatePattern(`calendar.*${recordId}`);
    this.events.emitToSchool(schoolId, 'calendar:updated', { calendarId: model === 'SchoolBusinessCalendar' ? recordId : undefined, recordId, action });
  }

  async list(actor: Actor, requestedSchoolId?: string, current = false) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_VIEW);
    const where: any = { schoolId };
    if (!actor.isSuperAdmin) {
      const permissions = await this.access.getPermissions(actor);
      if (!permissions.includes(PERMISSIONS.CALENDAR_MANAGE)) where.status = 'PUBLISHED';
    }
    if (current) {
      const now = new Date();
      where.startDate = { lte: now };
      where.endDate = { gte: now };
    }
    return this.prisma.schoolBusinessCalendar.findMany({ where, include: { categories: true, columns: { orderBy: { sortOrder: 'asc' } } }, orderBy: { startDate: 'desc' } });
  }

  async create(actor: Actor, data: any, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    const startDate = this.date(data.startDate, 'startDate');
    const endDate = this.date(data.endDate, 'endDate');
    this.validateRange(startDate, endDate);
    await this.schoolReferences(schoolId, data);
    const calendar = await this.prisma.schoolBusinessCalendar.create({ data: { schoolId, academicYearId: data.academicYearId, termId: data.termId, name: data.name, description: data.description, startDate, endDate, timezone: data.timezone, createdById: actor.isSuperAdmin ? undefined : actor.id } });
    await this.audit(actor, schoolId, 'CALENDAR_CREATED', 'SchoolBusinessCalendar', calendar.id, { name: calendar.name });
    return calendar;
  }

  async update(actor: Actor, id: string, data: any, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    const existing = await this.calendar(id, schoolId);
    const startDate = data.startDate ? this.date(data.startDate, 'startDate') : existing.startDate;
    const endDate = data.endDate ? this.date(data.endDate, 'endDate') : existing.endDate;
    this.validateRange(startDate, endDate);
    if (data.academicYearId || data.termId) await this.schoolReferences(schoolId, { academicYearId: data.academicYearId || existing.academicYearId, termId: data.termId ?? existing.termId });
    const calendar = await this.prisma.schoolBusinessCalendar.update({ where: { id }, data: { ...data, startDate, endDate, version: { increment: 1 }, updatedById: actor.isSuperAdmin ? undefined : actor.id, academicYearId: undefined, termId: undefined } });
    await this.audit(actor, schoolId, 'CALENDAR_UPDATED', 'SchoolBusinessCalendar', id, data);
    return calendar;
  }

  async remove(actor: Actor, id: string, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    await this.calendar(id, schoolId);
    await this.prisma.schoolBusinessCalendar.delete({ where: { id } });
    await this.audit(actor, schoolId, 'CALENDAR_DELETED', 'SchoolBusinessCalendar', id);
    return { id, deleted: true };
  }

  async setStatus(actor: Actor, id: string, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED', requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, status === 'PUBLISHED' ? PERMISSIONS.CALENDAR_PUBLISH : PERMISSIONS.CALENDAR_MANAGE);
    await this.calendar(id, schoolId);
    const updated = await this.prisma.schoolBusinessCalendar.update({ where: { id }, data: { status, publishedAt: status === 'PUBLISHED' ? new Date() : undefined, archivedAt: status === 'ARCHIVED' ? new Date() : undefined } });
    await this.audit(actor, schoolId, `CALENDAR_${status}`, 'SchoolBusinessCalendar', id, { status });
    return updated;
  }

  async activities(actor: Actor, calendarId: string, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_VIEW);
    const calendar = await this.calendar(calendarId, schoolId);
    if (!actor.isSuperAdmin && calendar.status !== 'PUBLISHED' && !(await this.access.getPermissions(actor)).includes(PERMISSIONS.CALENDAR_MANAGE)) throw new ForbiddenException('Calendar is not published');
    return this.prisma.calendarActivity.findMany({ where: { calendarId, schoolId }, include: { subItems: { orderBy: { sortOrder: 'asc' } }, audiences: true, category: true, children: true }, orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }] });
  }

  async createActivity(actor: Actor, calendarId: string, data: any, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    const calendar = await this.calendar(calendarId, schoolId);
    const startDate = this.date(data.startDate, 'startDate');
    const endDate = this.date(data.endDate || data.startDate, 'endDate');
    this.validateRange(startDate, endDate);
    if (data.termId) await this.schoolReferences(schoolId, { academicYearId: calendar.academicYearId, termId: data.termId });
    if (data.parentId) { const parent = await this.activity(data.parentId, schoolId); if (parent.calendarId !== calendarId) throw new BadRequestException('Parent activity must be in this calendar'); }
    if (data.categoryId) { const category = await this.prisma.calendarCategory.findFirst({ where: { id: data.categoryId, schoolId, OR: [{ calendarId }, { calendarId: null }] } }); if (!category) throw new BadRequestException('Invalid calendar category'); }
    const activity = await this.prisma.calendarActivity.create({ data: { ...data, schoolId, calendarId, startDate, endDate, deadline: data.deadline ? this.date(data.deadline, 'deadline') : undefined, createdById: actor.isSuperAdmin ? undefined : actor.id } });
    await this.audit(actor, schoolId, 'CALENDAR_ACTIVITY_CREATED', 'CalendarActivity', activity.id, { calendarId });
    return activity;
  }

  async updateActivity(actor: Actor, id: string, data: any, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    const existing = await this.activity(id, schoolId);
    const startDate = data.startDate ? this.date(data.startDate, 'startDate') : existing.startDate;
    const endDate = data.endDate ? this.date(data.endDate, 'endDate') : existing.endDate;
    this.validateRange(startDate, endDate);
    const activity = await this.prisma.calendarActivity.update({ where: { id }, data: { ...data, startDate, endDate, deadline: data.deadline ? this.date(data.deadline, 'deadline') : undefined, calendarId: undefined, schoolId: undefined, updatedById: actor.isSuperAdmin ? undefined : actor.id } });
    await this.audit(actor, schoolId, 'CALENDAR_ACTIVITY_UPDATED', 'CalendarActivity', id, data);
    if (data.status === 'CANCELLED') await this.notifications.notifyChange(id, 'CANCELLED');
    else if (['startDate', 'endDate', 'startTime', 'endTime', 'venue'].some((field) => data[field] !== undefined)) await this.notifications.notifyChange(id, 'UPDATED');
    return activity;
  }

  async removeActivity(actor: Actor, id: string, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE); await this.activity(id, schoolId);
    await this.prisma.calendarActivity.delete({ where: { id } }); await this.audit(actor, schoolId, 'CALENDAR_ACTIVITY_DELETED', 'CalendarActivity', id); return { id, deleted: true };
  }

  async subItem(actor: Actor, activityId: string, data: any, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE); await this.activity(activityId, schoolId);
    return this.prisma.calendarActivitySubItem.create({ data: { activityId, title: data.title, notes: data.notes, dueDate: data.dueDate ? this.date(data.dueDate, 'dueDate') : undefined, isComplete: data.isComplete, sortOrder: data.sortOrder } });
  }

  async removeSubItem(actor: Actor, id: string, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    const item = await this.prisma.calendarActivitySubItem.findFirst({ where: { id, activity: { schoolId } } }); if (!item) throw new NotFoundException('Sub-item not found');
    await this.prisma.calendarActivitySubItem.delete({ where: { id } }); return { id, deleted: true };
  }

  async audience(actor: Actor, activityId: string, data: any, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE); await this.activity(activityId, schoolId);
    if (data.userId && !(await this.prisma.user.findFirst({ where: { id: data.userId, schoolId } }))) throw new BadRequestException('User does not belong to this school');
    if (data.departmentId && !(await this.prisma.department.findFirst({ where: { id: data.departmentId, schoolId } }))) throw new BadRequestException('Department does not belong to this school');
    return this.prisma.calendarActivityAudience.create({ data: { activityId, type: data.type, userId: data.userId, departmentId: data.departmentId, label: data.label } });
  }

  async removeAudience(actor: Actor, id: string, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE);
    const audience = await this.prisma.calendarActivityAudience.findFirst({ where: { id, activity: { schoolId } } }); if (!audience) throw new NotFoundException('Audience not found');
    await this.prisma.calendarActivityAudience.delete({ where: { id } }); return { id, deleted: true };
  }

  async categories(actor: Actor, requestedSchoolId?: string) { const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_VIEW); return this.prisma.calendarCategory.findMany({ where: { schoolId, isActive: true }, orderBy: { name: 'asc' } }); }
  async saveCategory(actor: Actor, data: any, requestedSchoolId?: string) { const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE); return this.prisma.calendarCategory.create({ data: { schoolId, calendarId: data.calendarId, name: data.name, color: data.color, description: data.description } }); }
  async columns(actor: Actor, calendarId: string, requestedSchoolId?: string) { const schoolId = this.schoolId(actor, requestedSchoolId); await this.calendar(calendarId, schoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_VIEW); return this.prisma.calendarColumnConfig.findMany({ where: { calendarId, schoolId }, orderBy: { sortOrder: 'asc' } }); }
  async saveColumns(actor: Actor, calendarId: string, columns: any[], requestedSchoolId?: string) { const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE); await this.calendar(calendarId, schoolId); return this.prisma.$transaction(columns.map((column) => this.prisma.calendarColumnConfig.upsert({ where: { calendarId_key: { calendarId, key: column.key } }, create: { ...column, calendarId, schoolId }, update: { ...column, schoolId } }))); }

  async exportCsv(actor: Actor, calendarId: string, requestedSchoolId?: string) {
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_EXPORT);
    const rows = await this.activities(actor, calendarId, requestedSchoolId);
    const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return ['title,startDate,endDate,startTime,endTime,deadline,status,priority,notes', ...rows.map((row: any) => [row.title, row.startDate.toISOString(), row.endDate.toISOString(), row.startTime, row.endTime, row.deadline?.toISOString(), row.status, row.priority, row.notes].map(escape).join(','))].join('\n');
  }

  async workbook(actor: Actor, calendarId: string, includeActivities: boolean, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_EXPORT);
    await this.calendar(calendarId, schoolId);
    return this.excel.createWorkbook(schoolId, calendarId, includeActivities);
  }

  async validateWorkbook(actor: Actor, calendarId: string, file: Express.Multer.File, mode: 'UPDATE_EXISTING' | 'FULL_SYNC', requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_IMPORT);
    await this.calendar(calendarId, schoolId);
    const parsed = await this.excel.parse(file.buffer, file.originalname, schoolId, calendarId, mode);
    const staged = await this.prisma.calendarImport.create({
      data: {
        schoolId, calendarId, uploadedById: actor.isSuperAdmin ? undefined : actor.id, filename: file.originalname,
        templateVersion: String(parsed.metadata.get('templateVersion')), schemaVersion: String(parsed.metadata.get('schemaVersion')), mode: mode as any,
        status: parsed.counts.errors ? 'INVALID' : 'VALID', totalRows: parsed.counts.total, validRows: parsed.counts.valid,
        warningRows: parsed.counts.warnings, errorRows: parsed.counts.errors, errorSummary: parsed.counts.errors ? { errors: parsed.rows.filter((row) => row.status === 'ERROR').flatMap((row) => row.errors) } : undefined,
        rows: { create: parsed.rows.map((row) => ({ rowNumber: row.rowNumber, rawData: row.rawData, normalizedData: row.normalizedData, status: row.status as any, errors: row.errors.length ? row.errors : undefined, changeType: row.changeType as any, existingActivityId: row.existingActivityId })) },
      }, include: { rows: true },
    });
    return this.importSummary(staged);
  }

  async importDetails(actor: Actor, importId: string, errorsOnly = false) {
    const schoolId = this.schoolId(actor);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_IMPORT);
    const item = await this.prisma.calendarImport.findFirst({ where: { id: importId, schoolId }, include: { rows: { orderBy: { rowNumber: 'asc' } }, calendar: true } });
    if (!item) throw new NotFoundException('Calendar import not found');
    if (errorsOnly) return { ...this.importSummary(item), rows: item.rows.filter((row) => row.status === 'ERROR' || row.status === 'WARNING') };
    return { ...this.importSummary(item), rows: item.rows };
  }

  async previewWorkbook(actor: Actor, calendarId: string, body: any, file?: Express.Multer.File) {
    if (file) return this.validateWorkbook(actor, calendarId, file, body?.mode === 'FULL_SYNC' ? 'FULL_SYNC' : 'UPDATE_EXISTING');
    if (!body?.importId) throw new BadRequestException('importId or file is required');
    const details = await this.importDetails(actor, body.importId);
    if (details.calendar?.id !== calendarId) throw new BadRequestException('Import does not belong to this calendar');
    return details;
  }

  async commitWorkbook(actor: Actor, calendarId: string, importId: string, confirmed: boolean, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId);
    await this.assertPermission(actor, PERMISSIONS.CALENDAR_IMPORT);
    if (!confirmed) throw new BadRequestException('Explicit confirmation is required');
    const staged = await this.prisma.calendarImport.findFirst({ where: { id: importId, schoolId, calendarId }, include: { rows: { orderBy: { rowNumber: 'asc' } } } });
    if (!staged) throw new NotFoundException('Calendar import not found');
    if (staged.status === 'COMMITTED') return this.importSummary(staged);
    if (staged.status !== 'VALID' || staged.rows.some((row) => row.status === 'ERROR')) throw new BadRequestException('Only a valid staged import can be committed');
    const result = await this.prisma.$transaction(async (tx: any) => {
      const calendar = await tx.schoolBusinessCalendar.findFirst({ where: { id: calendarId, schoolId } });
      if (!calendar) throw new NotFoundException('Calendar not found');
      const existing = await tx.calendarActivity.findMany({ where: { calendarId, schoolId } });
      const byCode = new Map(existing.filter((item: any) => item.activityCode).map((item: any) => [item.activityCode, item]));
      const byStable = new Map(existing.map((item: any) => [`${item.title}|${item.startDate.toISOString()}|${item.officerId || ''}`, item]));
      const importedCodes = new Set<string>(); let created = 0; let updated = 0; let unchanged = 0;
      const parentCodes = new Map<string, string>();
      for (const row of staged.rows) {
        const data: any = row.normalizedData; if (!data) continue;
        const match = (data.activityCode && byCode.get(data.activityCode)) || byStable.get(`${data.title}|${new Date(data.startDate).toISOString()}|${data.officerId || ''}`);
        const payload = { activityCode: data.activityCode || null, title: data.title, description: data.description, startDate: new Date(data.startDate), endDate: new Date(data.endDate), startTime: data.startTime, endTime: data.endTime, allDay: data.allDay, categoryId: data.categoryId, departmentId: data.departmentId, officerId: data.officerId, status: data.status || 'PLANNED', priority: data.priority || 'NORMAL', deadline: data.deadline ? new Date(data.deadline) : null, notes: data.notes, updatedById: actor.isSuperAdmin ? undefined : actor.id };
        if (match) {
          const same = ['title', 'description', 'startDate', 'endDate', 'startTime', 'endTime', 'categoryId', 'departmentId', 'officerId', 'status', 'priority', 'notes'].every((field) => String((match as any)[field] ?? '') === String(payload[field] ?? ''));
          if (same) unchanged++; else { await tx.calendarActivity.update({ where: { id: match.id }, data: payload }); updated++; }
          parentCodes.set(data.activityCode, match.id); importedCodes.add(match.id);
          await tx.calendarImportRow.update({ where: { id: row.id }, data: { status: 'COMMITTED', existingActivityId: match.id, changeType: same ? 'UNCHANGED' : 'UPDATE' } });
        } else {
          const createdActivity = await tx.calendarActivity.create({ data: { ...payload, schoolId, calendarId, createdById: actor.isSuperAdmin ? undefined : actor.id } });
          created++; parentCodes.set(data.activityCode, createdActivity.id); importedCodes.add(createdActivity.id);
          await tx.calendarImportRow.update({ where: { id: row.id }, data: { status: 'COMMITTED', existingActivityId: createdActivity.id, changeType: 'CREATE' } });
        }
      }
      if (staged.mode === 'FULL_SYNC') for (const item of existing) if (!importedCodes.has(item.id)) await tx.calendarActivity.update({ where: { id: item.id }, data: { status: 'CANCELLED', updatedById: actor.isSuperAdmin ? undefined : actor.id } });
      await tx.calendarImport.update({ where: { id: staged.id }, data: { status: 'COMMITTED', committedAt: new Date(), createdCount: created, updatedCount: updated, unchangedCount: unchanged } });
      await tx.schoolBusinessCalendar.update({ where: { id: calendarId }, data: { version: { increment: 1 }, updatedById: actor.isSuperAdmin ? undefined : actor.id } });
      await tx.calendarAuditEvent.create({ data: { schoolId, calendarId, userId: actor.isSuperAdmin ? undefined : actor.id, action: 'CALENDAR_IMPORT_COMMITTED', changes: { importId: staged.id, created, updated, unchanged, mode: staged.mode } } });
      return { created, updated, unchanged, conflicts: 0, warnings: staged.warningRows, errors: 0 };
    }, { timeout: 120000, maxWait: 60000 });
    this.cache.invalidatePattern(`calendar.*${calendarId}`); this.events.emitToSchool(schoolId, 'calendar:updated', { calendarId, importId });
    return result;
  }

  private importSummary(item: any) { return { id: item.id, status: item.status, mode: item.mode, filename: item.filename, totalRows: item.totalRows, validRows: item.validRows, warningRows: item.warningRows, errorRows: item.errorRows, created: item.createdCount, updated: item.updatedCount, unchanged: item.unchangedCount, conflicts: item.conflictCount, errorSummary: item.errorSummary }; }

  async importCsv(actor: Actor, calendarId: string, csv: string, requestedSchoolId?: string) {
    const schoolId = this.schoolId(actor, requestedSchoolId); await this.assertPermission(actor, PERMISSIONS.CALENDAR_MANAGE); await this.calendar(calendarId, schoolId);
    const lines = csv.split(/\r?\n/).filter(Boolean); if (lines.length < 2) return { imported: 0 };
    const headers = this.parseCsvLine(lines[0]).map((header) => header.trim()); let imported = 0;
    for (const line of lines.slice(1)) { const values = this.parseCsvLine(line); const row = Object.fromEntries(headers.map((header, index) => [header, values[index]])); if (!row.title) continue; await this.createActivity(actor, calendarId, row, schoolId); imported++; }
    return { imported };
  }

  private parseCsvLine(line: string) { const result: string[] = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { result.push(value); value = ''; } else value += char; } result.push(value); return result; }
}
