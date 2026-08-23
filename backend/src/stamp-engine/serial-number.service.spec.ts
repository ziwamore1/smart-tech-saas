import { SerialNumberService } from './serial-number.service';

describe('SerialNumberService', () => {
  let svc: SerialNumberService;
  const prismaMock: any = {
    $queryRaw: jest.fn(),
    documentSerial: { create: jest.fn() },
  };

  beforeEach(() => {
    svc = new SerialNumberService(prismaMock);
    jest.clearAllMocks();
  });

  it('formats default pattern STS-TYPE-YEAR-SEQ with zero padding', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ nextValue: 2 }]); // first allocation = seq 1
    const result = await svc.allocate('school-1', { documentType: 'TRANSCRIPT' });
    expect(result.serialNumber).toBe(`STS-TRANSCRIPT-${new Date().getUTCFullYear()}-000001`);
    expect(result.sequence).toBe(1);
  });

  it('honours custom prefix, pattern and padding', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ nextValue: 125 }]);
    const result = await svc.allocate('school-1', {
      documentType: 'CERT',
      prefix: 'zab',
      pattern: '{PREFIX}/{TYPE}/{YEAR}/{SEQ}',
      padding: 4,
    });
    expect(result.serialNumber).toBe(`ZAB/CERT/${new Date().getUTCFullYear()}/0124`);
  });

  it('uses academic year scope when configured', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ nextValue: 2 }]);
    const result = await svc.allocate('school-1', {
      documentType: 'REPORT',
      yearSource: 'academic',
      academicYear: '2026',
    });
    expect(result.scopeKey).toBe('REPORT:2026');
    expect(result.serialNumber).toContain('2026');
  });

  it('allocates strictly increasing sequences (simulated concurrent transactions)', async () => {
    // Each concurrent transaction receives a distinct RETURNING value.
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ nextValue: 2 }])   // txn A -> 1
      .mockResolvedValueOnce([{ nextValue: 3 }])   // txn B -> 2
      .mockResolvedValueOnce([{ nextValue: 41 }]); // txn C -> 40

    const [a, b, c] = await Promise.all([
      svc.allocate('school-1', { documentType: 'DOC' }),
      svc.allocate('school-1', { documentType: 'DOC' }),
      svc.allocate('school-1', { documentType: 'DOC' }),
    ]);
    const set = new Set([a.serialNumber, b.serialNumber, c.serialNumber]);
    expect(set.size).toBe(3);
  });

  it('retries on unique collision and persists the issued serial', async () => {
    const conflict: any = new Error('unique constraint');
    conflict.code = 'P2002';
    prismaMock.$queryRaw.mockResolvedValue([{ nextValue: 2 }, { nextValue: 3 }]);
    prismaMock.documentSerial.create
      .mockRejectedValueOnce(conflict)
      .mockImplementationOnce(async (_args: any) => _args.data);

    const record = await svc.issue('school-1', { documentType: 'TRANSCRIPT' }, {});
    expect(record.serialNumber).toBeTruthy();
    expect(prismaMock.documentSerial.create).toHaveBeenCalledTimes(2);
  });
});
