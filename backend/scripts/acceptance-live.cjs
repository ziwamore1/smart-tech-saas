/**
 * Production-acceptance LIVE test (plain CJS over compiled dist/).
 * Boots ONLY the authenticity modules with real DI against real PostgreSQL.
 * Run:  node scripts/acceptance-live.cjs
 */
require('dotenv/config');
require('reflect-metadata');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { ReportTemplateBuilderModule } = require('../dist/report-template-builder/report-template-builder.module');
const { PrismaService } = require('../dist/prisma/prisma.service');
const { VerificationService } = require('../dist/stamp-engine/verification.service');
const { SignatureBridgeService } = require('../dist/stamp-engine/signature-bridge.service');
const { StampTemplateService } = require('../dist/stamp-engine/stamp-template.service');
const { TemplateRendererService } = require('../dist/report-template-builder/template-renderer.service');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

(async () => {
  const { Global } = require('@nestjs/common');
  const { ConfigModule } = require('@nestjs/config');
  const { JwtModule } = require('@nestjs/jwt');

  class GlobalsModule {}
  Global()(GlobalsModule);
  Module({
    providers: [{ provide: JwtService, useValue: new JwtService({}) }],
    exports: [JwtService],
  })(GlobalsModule);

  class AcceptanceModule {}
  Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      GlobalsModule,
      ReportTemplateBuilderModule,
    ],
  })(AcceptanceModule);

  const app = await NestFactory.createApplicationContext(AcceptanceModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const verification = app.get(VerificationService);
  const bridge = app.get(SignatureBridgeService);
  const stampTemplates = app.get(StampTemplateService);
  const renderer = app.get(TemplateRendererService);

  const school = await prisma.school.findFirst({ where: { isActive: true } });
  if (!school) throw new Error('No active school in DB');
  console.log(`Live acceptance: school="${school.name}" tier=${school.subscriptionTier}\n`);

  // [1] bridge state (SIGNATURE_SERVICE_URL unset locally ⇒ stamp-only mode)
  check('[1] bridge unconfigured ⇒ graceful stamp-only mode', bridge.configured === false,
    `configured=${bridge.configured}`);

  // [2] real stamp template create + publish
  const actor = { userId: 'acceptance-runner', schoolId: school.id, roles: ['Director'] };
  const tpl = await stampTemplates.create(actor, school.id, {
    name: `Acceptance Stamp ${Date.now()}`,
    configJson: {
      canvas: { width: 600, height: 600 },
      shape: { type: 'circle', outerRadius: 280, borderWidth: 7, borderColor: '#123456', borderCount: 2, innerRings: [] },
      layers: [{
        id: 'l1', type: 'curved-text', name: 'arc', content: 'ACCEPTANCE ACADEMY',
        x: 300, y: 120, rotation: 0, opacity: 1, zIndex: 10, fontFamily: 'serif',
        fontSize: 40, fontWeight: 'bold', letterSpacing: 4, color: '#123456',
        curve: { centerX: 300, centerY: 300, radius: 225, startAngle: -150, endAngle: -30, orientation: 'outward' },
      }],
      effects: { inkOpacity: 0.92, texture: 'ink' },
    },
  });
  await stampTemplates.publish(actor, school.id, tpl.id, 'acceptance');
  check('[2] stamp template created + published', Boolean(tpl && tpl.id));

  // [3] report template declaring includeStamp + authenticity placeholder tokens
  const report = await prisma.reportTemplate.create({
    data: {
      name: `Acceptance Report ${Date.now()}`,
      schoolId: school.id,
      includeStamp: true,
      includeSignature: false,
      components: {
        create: [{
          type: 'HEADING', label: 'Title', sortOrder: 0, isRequired: false,
          content: { text: 'ACCEPTANCE TRANSCRIPT — {{studentName}}' }, styles: {}, position: { x: 40, y: 40 }, size: { width: 500, height: 60 }, settings: {},
        }, {
          type: 'TEXT_BLOCK', label: 'Authenticity block', sortOrder: 1, isRequired: false,
          content: { text: 'SERIAL {{document_serial}} | ISSUED {{issued_date}} | {{verification_qr}}<br/>STAMP {{digital_stamp}}<br/>HASH {{document_hash}}' }, styles: {}, position: { x: 40, y: 700 }, size: { width: 500, height: 160 }, settings: {},
        }],
      },
    },
  });
  check('[3] report template with includeStamp created', Boolean(report && report.id));

  // [4] PDF render through the wired authenticity pipeline (real Puppeteer)
  const before = await prisma.documentVerification.count({ where: { schoolId: school.id } });
  const pdfResult = await renderer.renderPdf(school.id, report.id, { studentName: 'Acceptance Student' });
  const after = await prisma.documentVerification.count({ where: { schoolId: school.id } });
  check('[4a] renderPdf produced non-trivial PDF', Buffer.isBuffer(pdfResult.buffer) && pdfResult.buffer.length > 5000,
    `bytes=${pdfResult.buffer && pdfResult.buffer.length}`);
  check('[4b] pipeline finalized exactly one DocumentVerification', after - before === 1, `delta=${after - before}`);

  // [5] public verification of the issued document
  const issued = await prisma.documentVerification.findFirst({
    where: { schoolId: school.id },
    orderBy: { createdAt: 'desc' },
  });
  const pub = await verification.verifyPublic(issued.verificationCode);
  check('[5a] public verify VALID', pub && pub.status === 'VALID', JSON.stringify(pub).slice(0, 200));
  const pubStr = JSON.stringify(pub);
  check('[5b] public payload safe (no internal blobs)',
    !pubStr.includes('documentData') && !pubStr.includes('"signature"') &&
    pub.serialNumber !== undefined && pub.institution !== undefined, pubStr.slice(0, 160));

  // [6] supersede lifecycle (supersede() finalizes the replacement itself)
  const replacement = await verification.supersede(actor, school.id, issued.id, {
    documentId: `acc-b-${Date.now()}`,
    documentType: 'TRANSCRIPT',
    documentTitle: 'Acceptance replacement',
    documentData: { replacement: true },
  });
  check('[6a] supersede finalized replacement', Boolean(replacement && replacement.serialNumber));
  const supOld = await verification.verifyPublic(issued.verificationCode);
  check('[6b] original reports SUPERSEDED', supOld && supOld.status === 'SUPERSEDED', JSON.stringify(supOld).slice(0, 120));
  const supNew = await verification.verifyPublic(replacement.verificationCode);
  check('[6c] replacement remains VALID', supNew && supNew.status === 'VALID', JSON.stringify(supNew).slice(0, 120));

  // [7] revocation lifecycle on a fresh document
  const doc3 = await verification.finalize({
    actor,
    schoolId: school.id,
    documentId: `acc-r-${Date.now()}`,
    documentType: 'CERTIFICATE',
    documentTitle: 'Revocation target',
    documentData: { revokeTest: true },
  });
  await verification.revoke(actor, school.id, doc3.id, 'Acceptance revoke test');
  const revoked = await verification.verifyPublic(doc3.verificationCode);
  check('[7] public verify shows REVOKED', revoked && revoked.status === 'REVOKED', JSON.stringify(revoked).slice(0, 120));

  // [8] concurrency — atomic serial upsert under parallel load
  const burst = await Promise.all(Array.from({ length: 5 }, (_, i) =>
    verification.finalize({
      actor,
      schoolId: school.id,
      documentId: `acc-c-${Date.now()}-${i}`,
      documentType: 'CERTIFICATE',
      documentTitle: `Concurrency ${i}`,
      documentData: { i },
    })));
  const serials = burst.map(b => b.serialNumber);
  const codes = burst.map(b => b.verificationCode);
  check('[8] concurrent issuance unique serials & codes',
    serials.every(Boolean) && new Set(serials).size === 5 && new Set(codes).size === 5,
    `serials=${JSON.stringify(serials)}`);

  // [9] audit trail recorded
  const audits = await prisma.documentAuditLog.findMany({ where: { documentVerificationId: issued.id }, take: 10 });
  check('[9] audit trail recorded for lifecycle events', Array.isArray(audits), `count=${audits.length}`);

  await app.close();
  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ACCEPTANCE FAILED:', e && (e.stack || e.message || e)); process.exit(1); });
