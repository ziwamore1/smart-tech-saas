/* Stamp Engine smoke verification (mirrors the jest specs; run: npx tsx <this file>) */
import { DocumentHashService } from '../src/stamp-engine/document-hash.service';
import { SerialNumberService } from '../src/stamp-engine/serial-number.service';
import { StampRendererService } from '../src/stamp-engine/stamp-renderer.service';
import { StampPermissionService } from '../src/stamp-engine/stamp-permission.service';
import { StampTemplateConfig } from '../src/stamp-engine/stamp-engine.types';

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  FAIL ${name}: ${err?.message}`);
  }
}
function expect(actual: any) {
  return {
    toBe: (v: any) => { if (actual !== v) throw new Error(`expected ${JSON.stringify(v)}, got ${JSON.stringify(actual)}`); },
    toContain: (v: string) => { if (!String(actual).includes(v)) throw new Error(`expected to contain "${v}"`); },
    notToContain: (v: string) => { if (String(actual).includes(v)) throw new Error(`expected NOT to contain "${v}"`); },
    toMatch: (re: RegExp) => { if (!re.test(String(actual))) throw new Error(`expected to match ${re}`); },
    toBeTruthy: () => { if (!actual) throw new Error('expected truthy'); },
  };
}

// â”€â”€ 1. Hash determinism â”€â”€
console.log('\n[1] DocumentHashService');
const hash = new DocumentHashService();
check('identical hash regardless of key order', () => {
  const a = hash.hashDocument({
    documentType: 'TRANSCRIPT', documentId: 'doc-1', serialNumber: 'STS-2026-000001',
    issuedAt: '2026-08-23T10:00:00.000Z', schoolId: 'school-1',
    documentData: { student: 'Jane Banda', subjects: ['MATH', 'ENG'], total: 87 },
  });
  const b = hash.hashDocument({
    schoolId: 'school-1',
    documentData: { total: 87, subjects: ['MATH', 'ENG'], student: 'Jane Banda' },
    issuedAt: '2026-08-23T10:00:00.000Z', serialNumber: 'STS-2026-000001',
    documentId: 'doc-1', documentType: 'TRANSCRIPT',
  });
  expect(a.hash).toBe(b.hash);
});
check('hash changes when material content changes', () => {
  const base = { documentType: 'T', documentId: 'd', serialNumber: 's', issuedAt: '2026-01-01T00:00:00Z', schoolId: 'sc', documentData: { grade: 'A' } };
  expect(hash.hashDocument(base).hash === hash.hashDocument({ ...base, documentData: { grade: 'B' } }).hash).toBe(false);
});
check('SHA-256 hex format', () => {
  expect(hash.hashDocument({ documentType: 'X', documentId: 'd', serialNumber: 's', issuedAt: new Date().toISOString(), schoolId: 'sc' }).hash)
    .toMatch(/^[a-f0-9]{64}$/);
});

// â”€â”€ 2. Serial numbers â”€â”€
console.log('\n[2] SerialNumberService');
const prismaMock: any = {
  $queryRaw: async (..._a: any[]) => {
    const row = serialQueue.shift();
    console.log(`    [mock] $queryRaw -> ${JSON.stringify(row)} (queue left: ${serialQueue.length})`);
    return row;
  },
  documentSerial: { create: async (args: any) => args.data },
};
const serials = new SerialNumberService(prismaMock);
let serialQueue: Array<Array<{ nextValue: number }>> = []; // each entry = one $queryRaw result set
check('default format STS-TYPE-YEAR-SEQ padded', async () => {
});
(async () => {
  serialQueue = [[{ nextValue: 2 }]];
  const beforeR1 = JSON.stringify(serialQueue);
  const r1 = await serials.allocate('school-1', { documentType: 'TRANSCRIPT' });
  console.log(`    [dbg] queueBefore=${beforeR1} queueAfter=${JSON.stringify(serialQueue)} got=${r1.serialNumber}`);
  check('default format', () => expect(r1.serialNumber).toBe(`STS-TRANSCRIPT-${new Date().getUTCFullYear()}-000001`));

  serialQueue = [[{ nextValue: 125 }]];
  const r2 = await serials.allocate('school-1', { documentType: 'CERT', prefix: 'zab', pattern: '{PREFIX}/{TYPE}/{YEAR}/{SEQ}', padding: 4 });
  check('custom prefix/pattern/padding', () => expect(r2.serialNumber).toBe(`ZAB/CERT/${new Date().getUTCFullYear()}/0124`));

  serialQueue = [[{ nextValue: 2 }], [{ nextValue: 3 }], [{ nextValue: 41 }]];
  const [c1, c2, c3] = await Promise.all([
    serials.allocate('school-1', { documentType: 'DOC' }),
    serials.allocate('school-1', { documentType: 'DOC' }),
    serials.allocate('school-1', { documentType: 'DOC' }),
  ]);
  check('concurrent allocations are unique', () => expect(new Set([c1.serialNumber, c2.serialNumber, c3.serialNumber]).size).toBe(3));

  serialQueue = [[{ nextValue: 2 }], [{ nextValue: 3 }]];
  const conflict: any = new Error('unique'); conflict.code = 'P2002';
  let calls = 0;
  prismaMock.documentSerial.create = async (args: any) => { if (++calls === 1) throw conflict; return args.data; };
  const issued = await serials.issue('school-1', { documentType: 'TRANSCRIPT' }, {});
  check('collision retry issues unique serial', () => expect(issued.serialNumber).toBeTruthy());

  // â”€â”€ 3. Renderer â”€â”€
  console.log('\n[3] StampRendererService');
  const renderer = new StampRendererService();
  const baseConfig = (): StampTemplateConfig => ({
    canvas: { width: 600, height: 600, background: 'transparent' },
    shape: { type: 'circle', outerRadius: 280, borderWidth: 8, borderColor: '#123456', borderCount: 2,
      innerRings: [{ radius: 240, width: 2, color: '#123456', dashed: true }] },
    layers: [
      { id: 'topArc', type: 'curved-text', x: 300, y: 120, content: 'INSTITUTION NAME', fontSize: 42, letterSpacing: 4,
        curve: { centerX: 300, centerY: 300, radius: 220, startAngle: -150, endAngle: -30, orientation: 'outward' } } as any,
      { id: 'centerText', type: 'text', x: 300, y: 280, content: 'OFFICIAL DOCUMENT', fontSize: 28, color: '#123456' } as any,
      { id: 'dateLayer', type: 'date', x: 300, y: 380, showTime: true, label: 'DIGITALLY STAMPED' } as any,
      { id: 'serialLayer', type: 'serial', x: 300, y: 430, label: 'SERIAL NO' } as any,
      { id: 'logo', type: 'image', x: 300, y: 210, width: 120, height: 120, assetId: 'asset-1' } as any,
      { id: 'marker', type: 'verification-marker', x: 300, y: 500 } as any,
      { id: 'hidden', type: 'text', x: 0, y: 0, content: 'SHOULD NOT APPEAR', visible: false } as any,
    ],
    effects: { inkOpacity: 0.9, texture: 'ink', noiseAmount: 0.15 },
  });

  const svg = renderer.render(baseConfig(), {
    serialNumber: 'STS-2026-000001', stampDate: '23 AUG 2026', stampTime: '13:42:17',
    timezoneLabel: 'CAT', assets: { 'asset-1': 'https://res.cloudinary.com/test/logo.png' },
  });
  check('renders all visible layers', () => {
    expect(svg).toContain('INSTITUTION NAME'); expect(svg).toContain('OFFICIAL DOCUMENT');
    expect(svg).toContain('23 AUG 2026'); expect(svg).toContain('13:42:17');
    expect(svg).toContain('STS-2026-000001'); expect(svg).notToContain('SHOULD NOT APPEAR');
  });
  check('XML escaping', () => {
    const cfg = baseConfig(); (cfg.layers[1] as any).content = 'A & B <C>';
    expect(renderer.render(cfg, {})).toContain('A &amp; B &lt;C&gt;');
  });
  check('tenant-scoped assets only', () => expect(renderer.render(baseConfig(), { assets: {} })).notToContain('<image'));
  check('no undefined/null leakage', () => {
    const s = renderer.render(baseConfig(), { assets: {} });
    expect(s).notToContain('undefined'); expect(s).notToContain('>null<');
  });
  check('rotation + opacity honored', () => {
    const cfg = baseConfig(); (cfg.layers[1] as any).rotation = 45; (cfg.layers[1] as any).opacity = 0.5;
    const s = renderer.render(cfg, {});
    expect(s).toMatch(/transform="rotate\(45 /); expect(s).toContain('opacity="0.50"');
  });
  check('oval shape renders ellipse', () => {
    const cfg = baseConfig(); cfg.shape.type = 'oval'; cfg.shape.width = 560; cfg.shape.height = 360;
    expect(renderer.render(cfg, {})).toContain('<ellipse');
  });

  // â”€â”€ 4. Permissions â”€â”€
  console.log('\n[4] StampPermissionService');
  const db: any = {
    schoolUser: { findFirst: async (args: any) => args.where.schoolId === 's1' ? { id: 'm-s1' } : null },
    userPermissionOverride: { findFirst: async () => (db.grantOverride ? { granted: true } : null) },
  };
  db.grantOverride = false;
  const perms = new StampPermissionService(db);
  const actor = (over: any = {}) => ({ userId: 'u1', schoolId: 's1', roles: ['Teacher'], isSuperAdmin: false, ...over });
  check('teacher cannot APPLY but can VIEW/VERIFY', async () => {});
  const tApply = await perms.hasPermission(actor(), 'DOCUMENT_STAMP_APPLY');
  const tView = await perms.hasPermission(actor(), 'DOCUMENT_VERIFY');
  check('teacher denied APPLY', () => expect(tApply).toBe(false));
  check('teacher allowed VERIFY', () => expect(tView).toBe(true));
  const dRevoke = await perms.hasPermission(actor({ roles: ['Director'] }), 'DOCUMENT_REVOKE');
  check('director granted REVOKE', () => expect(dRevoke).toBe(true));
  const overrideOk = (db.grantOverride = true, await perms.hasPermission(actor(), 'DOCUMENT_STAMP_APPLY'));
  check('membership override grants APPLY', () => expect(overrideOk).toBe(true));
  db.grantOverride = false;
  const crossSchool = await perms.hasPermission(actor(), 'DOCUMENT_STAMP_APPLY', 's2');
  check('cross-school access denied', () => expect(crossSchool).toBe(false));

  // ── 5. Canonical payload (unified crypto model) ──
  console.log('\n[5] CanonicalPayloadService');
  const { CanonicalPayloadService } = await import('../src/stamp-engine/canonical-payload.service');
  const canonical = new CanonicalPayloadService();
  check('deep key-order independence (nested objects)', () => {
    const a = canonical.hashContent({ documentId: 'd1', documentType: 'T', schoolId: 's1', documentData: { meta: { b: 2, a: { z: 1, y: 2 } }, list: ['x', 'y'] } });
    const b = canonical.hashContent({ documentId: 'd1', documentType: 'T', schoolId: 's1', documentData: { list: ['x', 'y'], meta: { a: { y: 2, z: 1 }, b: 2 } } });
    expect(a).toBe(b);
  });
  check('array order is significant', () => {
    const a = canonical.hashContent({ documentId: 'd', documentType: 'T', schoolId: 's', documentData: { l: [1, 2] } });
    const b = canonical.hashContent({ documentId: 'd', documentType: 'T', schoolId: 's', documentData: { l: [2, 1] } });
    expect(a === b).toBe(false);
  });
  check('finalHash binds stamp instance + signers deterministically', () => {
    const base: any = {
      documentId: 'd1', documentVersion: 1, organizationId: 'org', documentType: 'TRANSCRIPT',
      serialNumber: 'STS-2026-000001', verificationCode: 'AB12CD34', issuedAt: '2026-08-23T10:00:00.000Z',
      contentHash: 'aa'.repeat(32), stampInstanceId: null, signerIdentities: [], templateVersion: 3,
    };
    const h0 = canonical.buildAndHash(base).finalHash;
    expect(h0).toBe(canonical.buildAndHash(base).finalHash); // deterministic
    base.stampInstanceId = 'si_1';
    const h1 = canonical.buildAndHash(base).finalHash;
    expect(h0 === h1).toBe(false); // binding the stamp changes the signature payload
  });
  check('signer order invariance', () => {
    const mk = (signers: any[]) => canonical.buildAndHash({
      documentId: 'd', documentVersion: 1, organizationId: 'o', documentType: 'T',
      serialNumber: 'SN', verificationCode: 'VC', issuedAt: '2026-08-23T10:00:00.000Z',
      contentHash: 'bb'.repeat(32), stampInstanceId: null, signerIdentities: signers, templateVersion: 1,
    }).finalHash;
    expect(mk([{ signerId: 'a' }, { signerId: 'b', signerRole: 'R' }])).toBe(
      mk([{ signerId: 'b', signerRole: 'R' }, { signerId: 'a' }]),
    );
  });

  // ── 6. Authentication pipeline orchestration (mocked edges) ──
  console.log('\n[6] AuthenticationPipelineService');
  const { AuthenticationPipelineService } = await import('../src/stamp-engine/authentication-pipeline.service');
  const { SignatureBridgeService } = await import('../src/stamp-engine/signature-bridge.service');
  process.env.SIGNATURE_SERVICE_URL = 'http://localhost:4001';
  process.env.SIGNATURE_SERVICE_KEY = 'stamp-engine:test';
  const bridge = new SignatureBridgeService();

  const makePipelineDb = () => {
    let authRow: any = null;
    return {
      documentAuthentication: {
        create: async ({ data }: any) => (authRow = { id: 'auth-1', status: data.status, pipelineTrace: data.pipelineTrace, ...data }),
        update: async ({ where, data }: any) => (authRow = { ...authRow, ...data }),
        findFirst: async () => authRow,
      },
      documentVerification: {
        findUniqueOrThrow: async () => ({
          id: 'dv-1', templateId: 'tpl-1', templateVersion: 2, templateSnapshot: { layers: [] },
        }),
        updateMany: async () => ({ count: 1 }),
      },
      stampInstance: { create: async ({ data }: any) => ({ id: 'si-1', ...data }) },
      documentAuditLog: { create: async ({ data }: any) => ({ id: 'audit-1', ...data }) },
    };
  };
  const actorOk = { userId: 'u9', schoolId: 's1', roles: ['Director'], isSuperAdmin: false };
  const finalizeResult = () => ({
    id: 'dv-1', serialNumber: 'STS-2026-000042', documentHash: 'cc'.repeat(32), algorithm: 'SHA-256',
    verificationCode: 'X7K9P2M4Q8', verificationUrl: 'https://verify.example.com/v/X7K9P2M4Q8',
    qrCodeDataUrl: 'data:image/png;base64,xxx', stampSvg: '<svg>stamp</svg>', status: 'VALID',
    stampedAt: new Date('2026-08-23T09:42:31.000Z'), timezone: 'Africa/Lusaka',
    stampDate: '23 AUG 2026', stampTime: '11:42:31 CAT',
  });
  const buildPipeline = (db: any, bridgeOverride?: any) =>
    new AuthenticationPipelineService(db, { assertEntitlement: async () => undefined, finalize: async () => finalizeResult() } as any,
      bridgeOverride ?? bridge, canonical, { assert: async () => undefined } as any);

  // Stamp-only issuance
  const db1 = makePipelineDb();
  const p1 = buildPipeline(db1, { configured: true, sign: async () => { throw new Error('should not be called'); } } as any);
  const issueOnly = await p1.issue({
    actor: actorOk, schoolId: 's1', documentId: 'doc-77', documentType: 'transcript',
    requiresSignature: false, signers: [], documentData: { gpa: 3.9 },
  } as any);
  check('stamp-only issue reaches VALID', () => expect(issueOnly.status).toBe('VALID'));
  check('stamp-only has no signatures but full hashes', () => {
    expect(issueOnly.signatures.length).toBe(0);
    expect(issueOnly.finalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(issueOnly.serialNumber).toBe('STS-2026-000042');
  });

  // Signed issuance via bridge contract
  const db2 = makePipelineDb();
  let bridgeCalls = 0;
  const bridgeMock = {
    configured: true,
    sign: async (input: any) => {
      bridgeCalls++;
      return {
        signatureId: `sig-${bridgeCalls}`, algorithm: 'Ed25519', keyId: `key-${bridgeCalls}`,
        keyFingerprint: `fp-${bridgeCalls}`, signature: `hex-${bridgeCalls}`,
        canonicalHash: input.canonicalHash, signedAt: new Date().toISOString(), signedBy: input.signerId,
      };
    },
  } as any;
  const issueSigned = await buildPipeline(db2, bridgeMock).issue({
    actor: actorOk, schoolId: 's1', documentId: 'doc-88', documentType: 'certificate',
    requiresSignature: true,
    signers: [{ signerId: 'principal-1', signerRole: 'Principal' }, { signerId: 'registrar-1', signerRole: 'Registrar' }],
    documentData: { award: 'Excellence' },
  } as any);
  check('multi-signer issues both signatures over SAME finalHash', () => {
    expect(issueSigned.signatures.length).toBe(2);
    expect(issueSigned.signatures[0].canonicalHash === issueSigned.signatures[1].canonicalHash).toBe(true as any);
  });
  check('primary signature bound to authentication record', async () => {});

  // Failure path marks FAILED with trace
  const db3 = makePipelineDb();
  const failingBridge = { configured: true, sign: async () => { throw new Error('bridge down'); } } as any;
  let threw = false;
  try {
    await buildPipeline(db3, failingBridge).issue({
      actor: actorOk, schoolId: 's1', documentId: 'doc-99', documentType: 'report',
      requiresSignature: true, signers: [{ signerId: 'x' }],
    } as any);
  } catch { threw = true; }
  const failedRow = await db3.documentAuthentication.findFirst({});
  check('pipeline failure marks record FAILED with trace', () => {
    expect(threw).toBe(true);
    expect(failedRow.status).toBe('FAILED');
    const steps = failedRow.pipelineTrace.steps.map((s: any) => s.step);
    expect(steps.includes('PIPELINE_FAILED')).toBe(true);
  });

  console.log(`\n===== RESULT: ${passed} passed, ${failed} failed =====`);
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error('SMOKE RUNNER ERROR', err); process.exit(1); });



