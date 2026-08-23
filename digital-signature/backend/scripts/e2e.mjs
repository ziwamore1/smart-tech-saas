/**
 * Digital Signature Service — end-to-end verification suite (15 checks).
 * Run against a live server:  node scripts/e2e.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://localhost:4001';
const SERVICE_KEY = process.env.INTERNAL_SERVICE_KEYS?.split(',')[0]?.split(':')[1]
  || process.env.SIGNATURE_SERVICE_KEY?.split(':')[1]
  || 'dev-internal-service-secret';
const EMAIL = process.env.E2E_EMAIL || 'admin@test.ac.zm';
const PASSWORD = process.env.E2E_PASSWORD || 'Passw0rd!23';
const crypto = await import('node:crypto');
const hex64 = () => crypto.randomBytes(32).toString('hex');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
async function j(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// ── wait for readiness ──
let up = false;
for (let i = 0; i < 30 && !up; i++) {
  try { const r = await fetch(BASE + '/health'); up = r.ok; } catch {}
  if (!up) await new Promise(r => setTimeout(r, 700));
}
if (!up) { console.error('Server never became healthy at', BASE); process.exit(1); }
console.log(`E2E against ${BASE}\n`);

// [1] legacy org login
const login = await j('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
const token = login.data?.accessToken || login.data?.token || login.data?.access_token;
check('[1] legacy org login', !!token, JSON.stringify(login.data));
const auth = { Authorization: `Bearer ${token}` };

const me = await j('GET', '/auth/me', null, auth);
const orgId = me.data?.organisation?.id;

// ensure an ACTIVE key exists before testing rotation semantics
await j('POST', '/signatures/keys', {}, auth);

// sign BEFORE rotation (pre-rotation signature)
const docA = await j('POST', '/signatures', {
  documentName: 'E2E Pre-Rotation Transcript', signerRole: 'REGISTRAR',
  content: { doc: 'A' }, signedBy: 'Registrar',
}, auth);
const sigA = docA.data;

// [2] rotation old→new (response shape: { rotatedFrom, activeKey })
const rot = await j('POST', '/signatures/keys/rotate', {}, auth);
const newKeyId = rot.data?.activeKey?.id ?? rot.data?.id ?? rot.data?.keyId;
check('[2] key rotation produces new key', Boolean(newKeyId) && newKeyId !== sigA?.keyId,
  JSON.stringify(rot.data));

// [3] exactly one ACTIVE key after rotation
const keys = await j('GET', '/signatures/keys', null, auth);
const activeKeys = (keys.data?.keys || []).filter(k => k.status === 'ACTIVE');
check('[3] exactly one ACTIVE key', activeKeys.length === 1, `got ${activeKeys.length}`);

// [4] pre-rotation signature still VALID (publicKey pinned per record; keyStatus ROTATED)
const vOld = await j('GET', `/signatures/verify/${sigA.id}`, null, auth);
check('[4] pre-rotation signature still VALID',
  vOld.data?.valid === true && vOld.data?.status === 'ACTIVE' && vOld.data?.keyStatus === 'ROTATED',
  JSON.stringify(vOld.data));

// [5] post-rotation signature uses NEW key
const docB = await j('POST', '/signatures', {
  documentName: 'E2E Post-Rotation Diploma', signerRole: 'DEAN',
  content: { doc: 'B' }, signedBy: 'Dean',
}, auth);
const sigB = docB.data;
check('[5] post-rotation signature uses new keyId', Boolean(sigB?.keyId) && sigB.keyId === newKeyId,
  `sig=${sigB?.keyId} new=${newKeyId}`);

// [6] internal API rejects MISSING service key
const noKey = await j('POST', '/internal/signatures/sign',
  { organizationId: orgId, documentHash: hex64() });
check('[6] internal rejects missing key', noKey.status === 401 || noKey.data?.statusCode === 401,
  `status=${noKey.status}`);

// [7] internal API rejects WRONG service key
const badKey = await j('POST', '/internal/signatures/sign',
  { organizationId: orgId, documentHash: hex64() }, { 'x-service-key': 'wrong-key' });
check('[7] internal rejects bad key', badKey.status === 401 || badKey.data?.statusCode === 401,
  `status=${badKey.status}`);

// [8] internal sign returns full contract
const h8 = hex64();
const isign = await j('POST', '/internal/signatures/sign', {
  organizationId: orgId, documentId: 'e2e-doc-8', documentType: 'TRANSCRIPT',
  documentHash: h8, signerRole: 'REGISTRAR', metadata: { e2e: true },
}, { 'x-service-key': SERVICE_KEY });
const s8 = isign.data || {};
check('[8] internal sign contract fields',
  s8.signatureId && s8.algorithm === 'Ed25519' && s8.keyId && s8.signature &&
  s8.canonicalHash === h8.toLowerCase() && s8.signedAt && s8.verificationCode,
  JSON.stringify(s8).slice(0, 200));

// [9] internal verify accepts the exact pair
const iverify = await j('POST', '/internal/signatures/verify',
  { documentHash: h8, signature: s8.signature }, { 'x-service-key': SERVICE_KEY });
check('[9] internal verify valid',
  iverify.data?.valid === true && iverify.data?.keyStatus === 'ACTIVE',
  JSON.stringify(iverify.data));

// [10] tampered hash fails cryptographically
const tamper = await j('POST', '/internal/signatures/verify',
  { documentHash: hex64(), signature: s8.signature }, { 'x-service-key': SERVICE_KEY });
check('[10] tampered hash invalid', tamper.data?.valid === false, JSON.stringify(tamper.data));

// [11] public-key PEM served
const pk = await j('GET', `/internal/signatures/public-key/${s8.keyId}`, null,
  { 'x-service-key': SERVICE_KEY });
check('[11] public-key PEM served',
  typeof pk.data?.publicKey === 'string' && pk.data.publicKey.includes('BEGIN PUBLIC KEY'),
  JSON.stringify(pk.data).slice(0, 120));

// [12] multi-signer: two rows over SAME finalHash stay independent
const isign2 = await j('POST', '/internal/signatures/sign', {
  organizationId: orgId, documentId: 'e2e-doc-8', documentType: 'TRANSCRIPT',
  documentHash: h8, signerRole: 'DEAN', metadata: { e2e: true },
}, { 'x-service-key': SERVICE_KEY });
const s8b = isign2.data || {};
// Ed25519 is deterministic: same org key + same message ⇒ identical signature bytes.
// Independence = distinct rows (own id/signerRole) bound to the SAME canonicalHash.
check('[12] multi-signer independent rows',
  s8b.signatureId && s8b.signatureId !== s8.signatureId &&
  s8b.canonicalHash === s8.canonicalHash,
  JSON.stringify(s8b).slice(0, 160));

// [13] revoked signature reports REVOKED
await j('PATCH', `/signatures/${sigB.id}/revoke`, { reason: 'E2E revoke' }, auth);
const vRevoked = await j('GET', `/signatures/verify/${sigB.id}`, null, auth);
check('[13] revoked invalid', vRevoked.data?.valid === false && vRevoked.data?.status === 'REVOKED',
  JSON.stringify(vRevoked.data));

// [14] verification events tracked
const ev = await j('GET', `/signatures/${sigA.id}/verification-events`, null, auth);
check('[14] verification events tracked', (ev.data?.events || []).length >= 1,
  `count=${ev.data?.events?.length}`);

// [15] superseded reported
const sup = await j('PATCH', `/signatures/${s8.signatureId}/supersede`,
  { replacementId: s8b.signatureId }, auth);
const vSup = await j('GET', `/signatures/verify/${s8.signatureId}`, null, auth);
check('[15] superseded reported',
  vSup.data?.status === 'SUPERSEDED' || (sup.status < 400 && vSup.data?.status === 'SUPERSEDED'),
  `sup=${JSON.stringify(sup.data)} v=${JSON.stringify(vSup.data)}`);

console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
process.exit(fail ? 1 : 0);
