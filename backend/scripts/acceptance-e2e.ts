/**
 * Production-acceptance E2E (Phases 6/7/11/13/15/16 live checks).
 * Run against a booted backend:  npx tsx scripts/acceptance-e2e.ts [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:3001/api/v1';
const EMAIL = process.env.E2E_EMAIL || 'probe-admin@smarttech.test';
const PASSWORD = process.env.E2E_PASSWORD || 'Acceptance!23';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
async function j(method: string, path: string, body?: any, token?: string, raw = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), type: res.headers.get('content-type') };
  let data: any = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// ── readiness ──
let up = false;
for (let i = 0; i < 40 && !up; i++) {
  try { const r = await fetch(BASE + '/health'); up = r.ok; } catch {}
  if (!up) await new Promise(r => setTimeout(r, 700));
}
if (!up) { console.error('Backend not healthy at', BASE); process.exit(1); }
console.log(`Acceptance E2E against ${BASE}\n`);

// [1] login
const login = await j('POST', '/auth/login', { identifier: EMAIL, password: PASSWORD });
const d: any = login.data || {};
const token = d.accessToken || d.token || d.access_token;
check('[1] login', !!token && login.status < 400, JSON.stringify(d).slice(0, 160));

// [2] stamp template create + publish
const stampCfg = {
  canvas: { width: 600, height: 600 },
  shape: { type: 'circle', outerRadius: 280, borderWidth: 7, borderColor: '#123456', borderCount: 2, innerRings: [] },
  layers: [
    { id: 'l1', type: 'curved-text', name: 'arc', content: 'ACCEPTANCE ACADEMY', x: 300, y: 120, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif', fontSize: 40, fontWeight: 'bold', letterSpacing: 4, color: '#123456', curve: { centerX: 300, centerY: 300, radius: 225, startAngle: -150, endAngle: -30, orientation: 'outward' } },
  ],
  effects: { inkOpacity: 0.92, texture: 'ink' },
};
const st = await j('POST', '/stamp-engine/templates', { name: `Acceptance Stamp ${Date.now()}`, configJson: stampCfg }, token);
check('[2a] stamp template create', st.status === 201 || st.status === 200, JSON.stringify(st.data).slice(0, 160));
const stampTemplateId = st.data?.id;
if (stampTemplateId) {
  const pub = await j('POST', `/stamp-engine/templates/${stampTemplateId}/publish`, { changeNote: 'acceptance' }, token);
  check('[2b] stamp template publish', pub.status < 400, JSON.stringify(pub.data).slice(0, 120));
}

// [3] report template declaring includeStamp + authenticity placeholders component
const rt = await j('POST', '/report-template-builder', {
  name: `Acceptance Report ${Date.now()}`,
  templateType: 'REPORT_CARD',
  includeStamp: true,
  components: [{
    type: 'TEXT', label: 'Authenticity block',
    content: 'SERIAL {{document_serial}} | ISSUED {{issued_date}} | {{verification_qr}} | STAMP {{digital_stamp}}',
    styles: {}, position: { x: 40, y: 700 }, size: { width: 500, height: 160 },
    settings: {}, sortOrder: 1, isRequired: false,
  }],
}, token);
check('[3] report template create (includeStamp)', rt.status === 201 || rt.status === 200, JSON.stringify(rt.data).slice(0, 200));
const reportId = rt.data?.id;

// [4] PDF render through the wired pipeline
let pdfStatus = 0, pdfType = '', pdfSize = 0;
if (reportId) {
  const pdf = await j('POST', `/report-template-builder/${reportId}/pdf`, { studentName: 'Acceptance Student' }, token, true);
  pdfStatus = pdf.status; pdfType = pdf.type || ''; pdfSize = pdf.buf.length;
}
check('[4] report PDF renders with authenticity pipeline', pdfStatus === 200 && pdfType.includes('pdf') && pdfSize > 5000,
  `status=${pdfStatus} type=${pdfType} bytes=${pdfSize}`);

// [5] a DocumentVerification record must exist with serial + code
const list = await j('GET', '/stamp-engine/documents?status=ACTIVE', undefined, token);
const docs: any[] = list.data?.documents || list.data || [];
const doc = docs[0];
check('[5] DocumentVerification issued by pipeline', Boolean(doc?.serialNumber && doc?.verificationCode),
  JSON.stringify(list.data).slice(0, 200));

// [6] public verification — no auth, safe payload only
if (doc?.verificationCode) {
  const pv = await j('GET', `/stamp-engine/public/verification/${doc.verificationCode}`);
  const p = pv.data || {};
  check('[6a] public verify VALID without login', p.status === 'VALID' && pv.status === 200, JSON.stringify(p).slice(0, 200));
  const payloadStr = JSON.stringify(p);
  check('[6b] public payload has no PII / internal hashes',
    !payloadStr.includes('documentData') && !payloadStr.includes('signatureJson') &&
    p.serialNumber !== undefined && p.institution !== undefined, payloadStr.slice(0, 160));
}

// [7] revocation lifecycle
if (doc?.id) {
  const rv = await j('POST', `/stamp-engine/documents/${doc.id}/revoke`, { reason: 'Acceptance revoke test' }, token);
  check('[7a] revoke accepted', rv.status < 400, JSON.stringify(rv.data).slice(0, 120));
  const pv2 = await j('GET', `/stamp-engine/public/verification/${doc.verificationCode}`);
  check('[7b] public verify shows REVOKED', (pv2.data as any)?.status === 'REVOKED', JSON.stringify(pv2.data).slice(0, 120));
}

// [8] supersede lifecycle: finalize replacement, supersede original
const finB = await j('POST', '/stamp-engine/documents/finalize', {
  documentType: 'TRANSCRIPT', documentTitle: 'Acceptance replacement',
  documentId: `acc-${Date.now()}`, documentData: { replacement: true },
}, token);
const docB = finB.data;
check('[8a] second finalize ok', Boolean(docB?.serialNumber), JSON.stringify(finB.data).slice(0, 140));
if (docB?.id && doc?.id) {
  const sup = await j('POST', `/stamp-engine/documents/${doc.id}/supersede`, { newDocumentId: docB.id }, token);
  check('[8b] supersede accepted', sup.status < 400, JSON.stringify(sup.data).slice(0, 120));
  const pv3 = await j('GET', `/stamp-engine/public/verification/${doc.verificationCode}`);
  check('[8c] original reports SUPERSEDED', (pv3.data as any)?.status === 'SUPERSEDED', JSON.stringify(pv3.data).slice(0, 120));
  const pv4 = await j('GET', `/stamp-engine/public/verification/${docB.verificationCode}`);
  check('[8d] replacement remains VALID', (pv4.data as any)?.status === 'VALID', JSON.stringify(pv4.data).slice(0, 120));
}

// [9] concurrency: parallel finalizes must never collide on serial/code
const burst = await Promise.all(Array.from({ length: 5 }, (_, i) =>
  j('POST', '/stamp-engine/documents/finalize', {
    documentType: 'CERTIFICATE', documentTitle: `Concurrency ${i}`,
    documentId: `acc-c-${Date.now()}-${i}`, documentData: { i },
  }, token)));
const serials = burst.map(b => b.data?.serialNumber).filter(Boolean);
const codes = burst.map(b => b.data?.verificationCode).filter(Boolean);
check('[9] concurrent issuance: unique serials & codes',
  serials.length === 5 && codes.length === 5 &&
  new Set(serials).size === 5 && new Set(codes).size === 5,
  `serials=${serials.length} codes=${codes.length}`);

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
