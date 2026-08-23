import { DocumentHashService } from './document-hash.service';

describe('DocumentHashService', () => {
  let svc: DocumentHashService;

  beforeEach(() => {
    svc = new DocumentHashService();
  });

  it('produces identical hashes for logically equal payloads regardless of key order', () => {
    const a = svc.hashDocument({
      documentType: 'TRANSCRIPT',
      documentId: 'doc-1',
      serialNumber: 'STS-2026-000001',
      issuedAt: '2026-08-23T10:00:00.000Z',
      schoolId: 'school-1',
      documentData: { student: 'Jane Banda', subjects: ['MATH', 'ENG'], total: 87 },
    });
    const b = svc.hashDocument({
      schoolId: 'school-1',
      documentData: { total: 87, subjects: ['MATH', 'ENG'], student: 'Jane Banda' },
      issuedAt: '2026-08-23T10:00:00.000Z',
      serialNumber: 'STS-2026-000001',
      documentId: 'doc-1',
      documentType: 'TRANSCRIPT',
    });
    expect(a.hash).toBe(b.hash);
  });

  it('changes the hash when any material content changes', () => {
    const base = {
      documentType: 'TRANSCRIPT',
      documentId: 'doc-1',
      serialNumber: 'STS-2026-000001',
      issuedAt: '2026-08-23T10:00:00.000Z',
      schoolId: 'school-1',
      documentData: { grade: 'A' as string | 'B' },
    };
    const h1 = svc.hashDocument(base).hash;
    const h2 = svc.hashDocument({ ...base, documentData: { grade: 'B' } }).hash;
    const h3 = svc.hashDocument({ ...base, serialNumber: 'STS-2026-000002' }).hash;
    expect(h2).not.toBe(h1);
    expect(h3).not.toBe(h1);
  });

  it('normalizes whitespace and numeric formats deterministically', () => {
    const a = svc.canonicalJson({ name: '  Jane  ', score: 88.0 });
    const b = svc.canonicalJson({ score: 88, name: 'Jane' });
    expect(a).toBe(b);
  });

  it('drops null/empty fields so absent vs empty are equivalent', () => {
    expect(svc.canonicalJson({ a: null, b: '', c: 'x' })).toBe(svc.canonicalJson({ c: 'x' }));
  });

  it('emits 64-char hex SHA-256', () => {
    expect(svc.hashDocument({
      documentType: 'X', documentId: 'd', serialNumber: 's',
      issuedAt: new Date().toISOString(), schoolId: 'sc',
    }).hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
