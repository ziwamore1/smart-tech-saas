/**
 * Production-acceptance HTTP test â€” exercises the REAL server: auth, guards,
 * RBAC-protected stamp-engine routes, PDF render over HTTP, public verification.
 * Run:  node scripts/acceptance-http.cjs http://localhost:3001/api/v1
 */
const BASE = process.argv[2] || 'http://localhost:3001/api/v1';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}
const unwrap = b => (b && typeof b === 'object' && b.data !== undefined) ? b.data : b;

(async () => {
  // [H1] login (Nest returns 201 for POST by default)
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'probe-admin@smarttech.test', password: 'Acceptance!23' }),
  });
  const login = await loginRes.json().catch(() => ({}));
  const token = login.access_token || login.accessToken || login.token;
  check('[H1] login issues token + Director role',
    [200, 201].includes(loginRes.status) && Boolean(token) &&
    JSON.stringify(login.user || login).includes('Director'), `status=${loginRes.status}`);
  const auth = { Authorization: `Bearer ${token}` };

  // [H2] stamp-engine templates list (authenticated)
  const tplRes = await fetch(`${BASE}/stamp-engine/templates`, { headers: auth });
  const tplBody = unwrap(await tplRes.json().catch(() => null));
  const tpls = Array.isArray(tplBody?.templates) ? tplBody.templates : tplBody;
  check('[H2] GET /stamp-engine/templates authorized list',
    tplRes.status === 200 && Array.isArray(tpls) && tpls.length > 0,
    `status=${tplRes.status} n=${Array.isArray(tpls) ? tpls.length : '?'}`);

  // [H3] documents list (valid enum value + invalid value must not 500)
  const docsRes = await fetch(`${BASE}/stamp-engine/documents?status=VALID`, { headers: auth });
  const docBody = unwrap(await docsRes.json().catch(() => null));
  const docRows = Array.isArray(docBody?.documents) ? docBody.documents : Array.isArray(docBody) ? docBody : [];
  check('[H3a] GET /stamp-engine/documents?status=VALID lists records',
    docsRes.status === 200 && docRows.length > 0, `status=${docsRes.status} n=${docRows.length}`);
  const badRes = await fetch(`${BASE}/stamp-engine/documents?status=GARBAGE`, { headers: auth });
  check('[H3b] invalid status filter no longer causes 500', badRes.status < 500, `status=${badRes.status}`);

  // [H4] unauthenticated access denied
  const anon = await fetch(`${BASE}/stamp-engine/documents`);
  check('[H4] unauthenticated documents request rejected', [401, 403].includes(anon.status),
    `status=${anon.status}`);

  // [H5] PDF render over HTTP â€” newest includeStamp report template
  const listRes = await fetch(`${BASE}/template-builder`, { headers: auth });
  const rows = unwrap(await listRes.json().catch(() => null));
  const candidates = (Array.isArray(rows) ? rows : []).filter(r => r.includeStamp === true)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  let pdfOk = false, pdfBytes = 0, pdfNote = '';
  const renderOne = async (target) => {
    try {
      const pdfRes = await fetch(`${BASE}/template-builder/${target.id}/pdf`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentName: 'HTTP Acceptance' }),
        signal: AbortSignal.timeout(90000),
      });
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      let pdf = buf;
      if (buf.subarray(0, 1).toString() === '{') {
        try { pdf = Buffer.from(Buffer.from(JSON.parse(buf.toString('utf8')).data || '', 'base64')); } catch {}
      }
      if (pdfRes.status < 300 && pdf.subarray(0, 4).toString() === '%PDF' && pdf.length > 5000) {
        pdfOk = true; pdfBytes = pdf.length;
        return;
      }
      pdfNote += `${target.id}: status=${pdfRes.status} bytes=${pdf.length}; `;
    } catch (e) {
      pdfNote += `${target.id}: ${e.name || 'error'}; `;
    }
  };
  for (const target of candidates.slice(0, 6)) { await renderOne(target); if (pdfOk) break; }
  if (!pdfOk) {
    for (const target of candidates.slice(0, 6)) {
      await new Promise(r => setTimeout(r, 1500));
      await renderOne(target);
      if (pdfOk) break;
    }
  }
  check('[H5] POST /template-builder/:id/pdf streams real PDF', pdfOk,
    `${pdfNote || 'no includeStamp templates listed'}`);

  // [H6] public verification endpoint (no auth)
  const activeRow = docRows.find(d => d.status === 'VALID');
  if (activeRow && activeRow.verificationCode) {
    const pubRes = await fetch(`${BASE}/public/verification/${activeRow.verificationCode}`);
    const pubBody = unwrap(await pubRes.json().catch(() => ({})));
    check('[H6] GET /public/verification/:code anonymous VALID',
      pubRes.status === 200 && pubBody.status === 'VALID',
      `status=${pubRes.status} body=${JSON.stringify(pubBody).slice(0, 120)}`);
  } else {
    check('[H6] skipped (no VALID code in list)', false);
  }

  // [H7] Rate limiting on public verification (RUNS LAST — global limiter throttles this IP after)
  if (activeRow && activeRow.verificationCode) {
    let saw429 = null;
    for (let i = 0; i < 130 && saw429 === null; i++) {
      try {
        const rr = await fetch(`${BASE}/public/verification/${activeRow.verificationCode}`, { signal: AbortSignal.timeout(5000) });
        if (rr.status === 429) {
          const rb = await rr.text();
          saw429 = { body: rb, headers: rr.headers.get('ratelimit-limit') !== null };
        }
      } catch {}
    }
    check('[H7a] public verification returns clean 429 under abuse', Boolean(saw429),
      'no 429 within 130 requests');
    if (saw429) {
      check('[H7b] 429 response leaks no internals', !saw429.body.includes('prisma') && !saw429.body.includes('stack') &&
        saw429.headers, saw429.body.slice(0, 120));
    }
    console.log('  INFO later suites against this server instance must wait out the limiter window or restart.');
  } else {
    check('[H7] skipped', false);
  }

  console.log(`\n===== HTTP RESULT: ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HTTP ACCEPTANCE FAILED:', e && (e.message || e)); process.exit(1); });

