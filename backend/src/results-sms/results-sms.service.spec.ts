import { ResultsSmsService } from './results-sms.service';
import { BadRequestException } from '@nestjs/common';

/* Hand-rolled in-memory Prisma covering the log/batch operations the service uses. */
function matches(row: any, where: any): boolean {
  if (!where) return true;
  for (const [key, value] of Object.entries(where)) {
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) { if (!((value.in || []).includes(row[key]))) return false; }
      else if ('lte' in value) { if (!(row[key] instanceof Date) || row[key] > value.lte) return false; }
      else if ('gt' in value) { if (!(row[key] instanceof Date) || row[key] <= value.gt) return false; }
      else if ('equals' in value) { if (row[key] !== value.equals) return false; }
      else if (!matches(row[key], value)) return false;
    } else if (row[key] !== value) return false;
  }
  return true;
}
function clean(data: any) { const out: any = {}; for (const [k, v] of Object.entries(data)) if (v !== undefined) out[k] = v; return out; }
function applyRow(row: any, data: any) {
  for (const [k, v] of Object.entries(clean(data))) {
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      if ('increment' in v) row[k] = (row[k] || 0) + v.increment;
      else if ('set' in v) row[k] = v.set;
      else row[k] = v;
    } else row[k] = v;
  }
}
function pick(row: any, select?: any) { if (!select) return row; const out: any = {}; for (const k of Object.keys(select)) out[k] = row[k]; return out; }

class FakePrisma {
  logs: any[] = [];
  batches: any[] = [];
  resultSmsLog: any;
  resultSmsBatch: any;
  constructor() {
    let idc = 0;
    this.resultSmsLog = {
      create: ({ data }: any) => { const row = { ...data, id: `log-${++idc}`, createdAt: new Date(), updatedAt: new Date() }; this.logs.push(row); return Promise.resolve(row); },
      update: ({ where, data }: any) => { const row = this.logs.find((l) => l.id === where.id); applyRow(row, data); row.updatedAt = new Date(); return Promise.resolve({ ...row }); },
      updateMany: ({ where, data }: any) => { let count = 0; for (const l of this.logs) { if (matches(l, where)) { applyRow(l, data); l.updatedAt = new Date(); count++; } } return Promise.resolve({ count }); },
      findUnique: ({ where, select }: any) => { const row = this.logs.find((l) => l.id === where.id); return Promise.resolve(row ? { ...pick(row, select) } : null); },
      findMany: ({ where, select }: any) => { const rows = this.logs.filter((l) => matches(l, where)).map((l) => ({ ...pick(l, select) })); return Promise.resolve(rows); },
      groupBy: ({ where, _count }: any) => { const totals: Record<string, number> = {}; for (const l of this.logs) { if (matches(l, where)) totals[l.status] = (totals[l.status] || 0) + (_count ? 1 : 1); } return Promise.resolve(Object.entries(totals).map(([status, n]) => ({ status, _count: { _all: n } }))); },
      count: ({ where }: any) => Promise.resolve(this.logs.filter((l) => matches(l, where)).length),
    };
    this.resultSmsBatch = {
      create: ({ data }: any) => { const row = { ...data }; this.batches.push(row); return Promise.resolve({ ...row }); },
      update: ({ where, data }: any) => { const row = this.batches.find((b) => b.id === where.id); Object.assign(row, clean(data)); return Promise.resolve({ ...row }); },
      updateMany: ({ where, data }: any) => { let count = 0; for (const b of this.batches) { if (matches(b, where)) { Object.assign(b, clean(data)); count++; } } return Promise.resolve({ count }); },
      findUnique: ({ where }: any) => { const row = this.batches.find((b) => b.id === where.id); return Promise.resolve(row ? { ...row } : null); },
      findFirst: ({ where }: any) => { const row = this.batches.find((b) => matches(b, where)); return Promise.resolve(row ? { ...row } : null); },
      findMany: ({ where, orderBy, take }: any) => { let rows = this.batches.filter((b) => matches(b, where)); if (take) rows = rows.slice(0, take); return Promise.resolve(rows.map((b) => ({ ...b }))); },
    };
  }
}

const VALID_1 = { phoneNumber: '+260970000001', phoneStatus: 'VALID', message: 'hello s1', resultVersion: 'v1', messageHash: 'h1', segments: 1, estimatedUnits: 1 };
const preview = {
  estimatedUnits: 2, totalStudents: 2, totalRecipients: 3,
  recipients: [
    { parentId: 'p1', parentName: 'M', studentId: 's1', studentName: 'S1', admissionNumber: 'A1', ...VALID_1 },
    { parentId: 'p2', parentName: 'M M', studentId: 's2', studentName: 'S2', admissionNumber: 'A2', phoneNumber: '+260970000002', phoneStatus: 'VALID', message: 'hello s2', resultVersion: 'v2', messageHash: 'h2', segments: 1, estimatedUnits: 1 },
    { parentId: 'p3', parentName: 'N', studentId: 's1', studentName: 'S1', admissionNumber: 'A1', phoneNumber: '097', phoneStatus: 'INVALID', message: 'hello s1', resultVersion: 'v1', messageHash: 'h1', segments: 1, estimatedUnits: 1, errorCode: 'INVALID_PHONE_NUMBER', errorSuggestion: 'Use international format' },
  ] as any[],
};

function makeService(fake: FakePrisma, opts?: { provider?: any; addJob?: any }) {
  let resolved: any = null;
  const factory = { getSchoolSmsProvider: jest.fn(async () => (resolved ??= opts?.provider ?? makeProvider())) };
  return new ResultsSmsService(
    fake as any,
    factory as any,
    { getCompositeResultsForStudent: async () => [] } as any,
    { addJob: (opts?.addJob ?? jest.fn(async () => ({ id: 'RESULTS-job' }))) } as any,
  );
}
function makeProvider(balance = 100) {
  return {
    send: jest.fn(async ({ to }: any) => {
      if (to.endsWith('000')) return { success: false, error: 'request timed out after 10s', provider: 'fake' };
      if (to.endsWith('111')) return { success: false, error: 'invalid phone number', provider: 'fake' };
      return { success: true, providerMessageId: `mid-${to}`, provider: 'fake' };
    }),
    getBalance: jest.fn(async () => ({ balance, currency: 'ZMW' })),
    healthCheck: jest.fn(async () => ({ status: 'ok', latencyMs: 4 })),
  };
}
function activeBatch(fake: FakePrisma, overrides?: any) { const b = { id: 'RESULTS-active', schoolId: 'sch', classId: 'c1', termId: 't1', status: 'PROCESSING', total: 2, sent: 0, failed: 0, retrying: 0, sending: 0, queued: 0, skipped: 0, pending: 2, progress: 0, estimatedUnits: 2, queuedAt: new Date(), lastActivityAt: new Date(), heartbeatAt: new Date(), ...overrides }; fake.batches.push(b); return b; }

describe('ResultsSmsService', () => {
  let svc: ResultsSmsService;
  let fake: FakePrisma;
  beforeEach(() => {
    fake = new FakePrisma();
    svc = makeService(fake);
  });

  it('Test 1 — normal batch: queued → processing → completed with accurate persisted counts', async () => {
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
    const send = await svc.sendResultsSms('sch', 'c1', 't1', 'u1');
    expect(send.status).toBe('QUEUED');
    expect(send.batchId).toMatch(/^RESULTS-/);

    const batch = await fake.resultSmsBatch.findFirst({ where: { id: send.batchId } });
    expect(batch.status).toBe('QUEUED');
    expect(batch.total).toBe(2);
    expect(fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'QUEUED').length).toBe(2);
    expect(fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'SKIPPED').length).toBe(1);

    const payload: any = { batchId: send.batchId, schoolId: 'sch', logs: fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'QUEUED').map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } })) };
    await svc.processQueuedBatch(payload);

    const done = await svc.getBatchStatus('sch', send.batchId);
    expect(done.status).toBe('COMPLETED');
    expect(done.sent).toBe(2);
    expect(done.failed).toBe(0);
    expect(done.pending).toBe(0);
    expect(done.progress).toBe(100);
    expect(fake.logs.filter((l) => l.batchId === send.batchId).every((l) => l.status === 'SENT' || l.status === 'SKIPPED')).toBe(true);
  });

  it('Test 2 — partial failures: completed_with_failures with 61 sent / 3 failed / 0 pending', async () => {
    const provider = {
      send: jest.fn(async ({ to }: any) => (to.endsWith('111') ? { success: false, error: 'invalid phone number', provider: 'fake' } : { success: true, providerMessageId: `mid-${to}`, provider: 'fake' })),
      getBalance: async () => ({ balance: 500, currency: 'ZMW' }),
      healthCheck: async () => ({ status: 'ok', latencyMs: 4 }),
    };
    svc = makeService(fake, { provider });
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue({
      ...preview,
      recipients: [
        { parentId: 'p1', parentName: 'M', studentId: 's1', studentName: 'S1', admissionNumber: 'A1', phoneNumber: '+260970000111', phoneStatus: 'VALID', message: 'm1', resultVersion: 'v1', messageHash: 'h1', segments: 1, estimatedUnits: 1 },
        ...Array.from({ length: 3 }, (_, i) => ({ parentId: `p${i + 2}`, parentName: 'M', studentId: `s${i + 2}`, studentName: `S${i + 2}`, admissionNumber: `A${i + 2}`, phoneNumber: `+2609700000${i + 2}`, phoneStatus: 'VALID', message: 'm', resultVersion: 'v', messageHash: 'h', segments: 1, estimatedUnits: 1 })),
      ],
    });
    const send = await svc.sendResultsSms('sch', 'c1', 't1', 'u1');
    await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs: fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'QUEUED').map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } })) });
    const done = await svc.getBatchStatus('sch', send.batchId);
    expect(done.status).toBe('COMPLETED_WITH_FAILURES');
    expect(done.sent).toBe(3);
    expect(done.failed).toBe(1);
    expect(done.pending).toBe(0);
  });

  it('Test 3 — provider timeout: retried, then failed with an actionable reason; batch continues', async () => {
    process.env.RESULTS_SMS_MAX_RETRIES = '1';
    try {
      const provider = {
        send: jest.fn(async ({ to }: any) => (to.endsWith('001') ? { success: false, error: 'request timed out after 10s', provider: 'fake' } : { success: true, providerMessageId: `mid-${to}`, provider: 'fake' })),
        getBalance: async () => ({ balance: 100, currency: 'ZMW' }),
        healthCheck: async () => ({ status: 'ok', latencyMs: 4 }),
      };
      svc = makeService(fake, { provider });
      jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
      const send = await svc.sendResultsSms('sch', 'c1', 't1', 'u1');
      const target = fake.logs.find((l) => l.batchId === send.batchId && l.status === 'QUEUED');

      await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs: [{ id: target.id, recipient: { phoneNumber: target.phoneNumber, message: target.message } }] });
      const afterFirst = await fake.resultSmsLog.findUnique({ where: { id: target.id } });
      expect(afterFirst.status).toBe('RETRYING');
      expect(afterFirst.retryCount).toBe(1);
      expect(afterFirst.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
      let status = await svc.getBatchStatus('sch', send.batchId);
      expect(status.status).toBe('PROCESSING');

      // Retry comes due; the full payload is re-processed (as the worker/monitor always does).
      await fake.resultSmsLog.update({ where: { id: target.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
      await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs: fake.logs.filter((l) => l.batchId === send.batchId && (l.status === 'QUEUED' || l.status === 'RETRYING')).map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } })) });

      const final = await fake.resultSmsLog.findUnique({ where: { id: target.id } });
      expect(final.status).toBe('PROVIDER_ERROR');
      expect(final.retryCount).toBe(2);
      expect(final.failureCode).toBe('PROVIDER_ERROR');
      expect(final.errorMessage).toMatch(/timed out/i);
      expect(final.failedAt).toBeInstanceOf(Date);
      status = await svc.getBatchStatus('sch', send.batchId);
      expect(status.status).toBe('COMPLETED_WITH_FAILURES');
      expect(status.failed).toBe(1);
    } finally { delete process.env.RESULTS_SMS_MAX_RETRIES; }
  });

  it('Test 4 — worker restart: completed recipients are never sent twice', async () => {
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
    const send = await svc.sendResultsSms('sch', 'c1', 't1', 'u1');
    const logs = fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'QUEUED').map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } }));
    const { getSchoolSmsProvider } = (svc as any).smsProviderFactory;
    const provider = await getSchoolSmsProvider('sch');

    await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs });
    const sendsAfterFirstRun = provider.send.mock.calls.length;
    expect(sendsAfterFirstRun).toBe(2);

    // Worker "restart": the same batch payload is delivered again.
    await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs });
    expect(provider.send.mock.calls.length).toBe(sendsAfterFirstRun); // no duplicate sends
    const done = await svc.getBatchStatus('sch', send.batchId);
    expect(done.sent).toBe(2);
    expect(done.status).toBe('COMPLETED');
  });

  it('Test 5 — duplicate send request while a batch is active is rejected', async () => {
    activeBatch(fake);
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
    await expect(svc.sendResultsSms('sch', 'c1', 't1', 'u1')).rejects.toMatchObject({ response: { code: 'DUPLICATE_BATCH' } });
  });

  it('Test 6 — zero recipients: clear validation error, no batch created', async () => {
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue({ ...preview, recipients: [] });
    await expect(svc.sendResultsSms('sch', 'c1', 't1', 'u1')).rejects.toThrow(BadRequestException);
    expect(fake.batches.length).toBe(0);
    expect(fake.logs.length).toBe(0);
  });

  it('Test 7 — insufficient SMS units: batch does not start', async () => {
    svc = makeService(fake, { provider: makeProvider(0) });
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
    await expect(svc.sendResultsSms('sch', 'c1', 't1', 'u1')).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_BALANCE' } });
    expect(fake.batches.length).toBe(0);
  });

  it('Test 8 — in-flight SENDING logs are never claimed twice after a restart', async () => {
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
    const send = await svc.sendResultsSms('sch', 'c1', 't1', 'u1');
    const { getSchoolSmsProvider } = (svc as any).smsProviderFactory;
    const provider = await getSchoolSmsProvider('sch');

    // Crash mid-flight: leave one recipient in SENDING, others still QUEUED.
    const targets = fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'QUEUED');
    await fake.resultSmsLog.update({ where: { id: targets[0].id }, data: { status: 'SENDING' } });

    // Recovery pass delivers only the QUEUED recipient, never the stranded one.
    await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs: targets.map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } })) });
    const stranded = await fake.resultSmsLog.findUnique({ where: { id: targets[0].id } });
    expect(stranded.status).toBe('SENDING'); // untouched by the processor
    expect(provider.send.mock.calls.length).toBe(1); // only the queued one was claimed
  });

  it('Test 9 — batch reaches a terminal state when providers are not configured (no silent stall)', async () => {
    const factory = { getSchoolSmsProvider: jest.fn(async () => null) };
    svc = new ResultsSmsService(fake as any, factory as any, { getCompositeResultsForStudent: async () => [] } as any, { addJob: jest.fn(async () => null) } as any);
    jest.spyOn(svc as any, 'getRecipients').mockResolvedValue(preview);
    const send = await svc.sendResultsSms('sch', 'c1', 't1', 'u1');
    await svc.processQueuedBatch({ batchId: send.batchId, schoolId: 'sch', logs: fake.logs.filter((l) => l.batchId === send.batchId && l.status === 'QUEUED').map((l) => ({ id: l.id, recipient: { phoneNumber: l.phoneNumber, message: l.message } })) });
    const done = await svc.getBatchStatus('sch', send.batchId);
    expect(done.status).toBe('FAILED');
    expect(done.failed).toBe(2);
    expect(done.errorCode).toBe('PROVIDER_NOT_CONFIGURED');
    const log = await fake.resultSmsLog.findUnique({ where: { id: fake.logs.find((l) => l.batchId === send.batchId && l.status === 'PROVIDER_ERROR')!.id } });
    expect(log.errorSuggestion).toMatch(/Configure an SMS provider/i);
  });
});