import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

process.env.SIGNATURE_SERVICE_URL = process.env.SIGNATURE_SERVICE_URL || 'http://127.0.0.1:4001';
process.env.SIGNATURE_SERVICE_KEY = process.env.SIGNATURE_SERVICE_KEY || 'stamp-engine:dev-internal-service-secret';

import { PrismaClient } from '@prisma/client';
import { CertificateRendererService } from '../src/report-template-builder/certificate-renderer.service';
import { DigitalStampService } from '../src/report-template-builder/digital-stamp.service';
import { TemplateRendererService } from '../src/report-template-builder/template-renderer.service';
import { DocumentHashService } from '../src/stamp-engine/document-hash.service';
import { SerialNumberService } from '../src/stamp-engine/serial-number.service';
import { StampRendererService } from '../src/stamp-engine/stamp-renderer.service';
import { StampAssetService } from '../src/stamp-engine/stamp-asset.service';
import { StampTemplateService } from '../src/stamp-engine/stamp-template.service';
import { DocumentAuditService } from '../src/stamp-engine/document-audit.service';
import { ApprovalConfigService } from '../src/stamp-engine/approval-config.service';
import { StampPermissionService } from '../src/stamp-engine/stamp-permission.service';
import { VerificationService } from '../src/stamp-engine/verification.service';
import { SignatureBridgeService } from '../src/stamp-engine/signature-bridge.service';

const SCHOOL_ID = '1483376a-bfcd-49dc-8af9-bb9a6ba260aa';
const TEMPLATE_ID = '5a6189a9-0b5e-4aca-8f88-a3ecab965cba';
const OUT_DIR = path.join(process.env.TEMP || '.', 'opencode', 'cert-verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

async function main() {
  const prisma: any = new PrismaClient();

  const cloudinaryStub: any = {
    uploadBuffer: async () => {
      throw new Error('cloudinary disabled in verification run');
    },
  };

  const hash = new DocumentHashService();
  const stampRenderer = new StampRendererService();
  const certificateRenderer = new CertificateRendererService();
  const stampAssets = new StampAssetService(prisma, cloudinaryStub);
  const stampTemplates = new StampTemplateService(prisma, hash);
  const serials = new SerialNumberService(prisma);
  const audit = new DocumentAuditService(prisma);
  const approvalConfig = new ApprovalConfigService(prisma);
  const permissions = new StampPermissionService(prisma);
  const verification = new VerificationService(
    prisma, hash, serials, stampRenderer, stampAssets, stampTemplates, audit, approvalConfig, permissions,
  );
  const digitalStamp = new DigitalStampService(prisma);
  const signatureBridge = new SignatureBridgeService();
  const renderer = new TemplateRendererService(
    prisma, digitalStamp, cloudinaryStub, certificateRenderer, verification,
    stampTemplates, stampRenderer, stampAssets, signatureBridge,
  );

  console.log(`Signature bridge configured: ${signatureBridge.configured}`);

  const school = await prisma.school.findUnique({ where: { id: SCHOOL_ID } });
  const student = await prisma.student.findFirst({
    where: { schoolId: SCHOOL_ID, admissionNumber: 'ST-2026-001' },
    include: { studentPhotos: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!student) throw new Error('Test student not found');
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, status: 'ACTIVE' },
    include: { class: true, academicYear: true },
  });
  const term = await prisma.term.findFirst({
    where: { academicYearId: enrollment.academicYearId, name: 'Term 2' },
  });

  const certificateNumber = `ST-CERT-${new Date().getFullYear()}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
  const data = {
    student: {
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      photoUrl: student.photoUrl || student.studentPhotos?.[0]?.imageUrl,
    },
    class: { name: enrollment.class.name },
    term: { name: term.name, academicYear: enrollment.academicYear.name },
    examType: 'END_TERM',
    certificateNumber,
    certificateComment:
      'Issued as a verification sample showing the SMART TECH authenticated seal together with the configured digital stamp and cryptographic digital signatures.',
    teacherComment: 'Outstanding academic performance.',
  };

  console.log(`\nRendering certificate for ${student.firstName} ${student.lastName} (${enrollment.class.name}, ${term.name} ${enrollment.academicYear.name})`);

  const html = await renderer.renderPreviewWithAuthenticity(SCHOOL_ID, TEMPLATE_ID, data);
  fs.writeFileSync(path.join(OUT_DIR, 'certificate.html'), html);

  console.log('\n[1] Seal');
  const sealMatch = html.match(/data:image\/png;base64,(iVBOR[A-Za-z0-9+/=]{20,})/);
  check('seal PNG (not SVG fallback) is embedded', Boolean(sealMatch), `len=${sealMatch ? sealMatch[1].length : 0}`);
  check('seal area positioned bottom-left', html.includes('.seal-area') && /\.seal-area\s*\{[^}]*left:\s*24px/.test(html));
  check('seal area no longer bottom-right', !/\.seal-area\s*\{[^}]*right:\s*24px/.test(html));

  console.log('\n[2] Digital stamp (default stamp designer template)');
  check('default stamp overlay present (fixed bottom-right)', html.includes('right:18mm;bottom:18mm'));
  check('stamp SVG rendered', /<svg[^>]*>[\s\S]*<\/svg>/.test(html));

  console.log('\n[2b] Certificate QR (from authenticity verification URL)');
  check('certificate QR area rendered', html.includes('class="qr-area"'), 'certificate carries the verification QR');

  console.log('\n[3] Digital signatures');
  const escapeHtml = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  check('authenticity signature block appended', html.includes('DIGITALLY SIGNED'));
  const signedCount = (html.match(/DIGITALLY SIGNED/g) || []).length;
  check('at least one signatory rendered', signedCount >= 1, `count=${signedCount}`);
  const headName = school.headTeacherName || 'Rostova Elena';
  check('head teacher name present', html.includes(headName) || html.includes(escapeHtml(headName)), `name=${headName}`);
  check('signatory roles present', html.includes('Head Teacher') && html.includes('Deputy Head Teacher'));

  console.log('\n[4] Certificate identity');
  check('student name present', html.includes(`${student.firstName} ${student.lastName}`));
  check('certificate number present', html.includes(certificateNumber));

  console.log('\n[5] PDF + screenshot render');
  const { buffer } = await renderer.renderPdfFromHtml(SCHOOL_ID, TEMPLATE_ID, html);
  fs.writeFileSync(path.join(OUT_DIR, 'certificate.pdf'), buffer);
  check('PDF produced', buffer.length > 1000, `bytes=${buffer.length}`);
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(buffer);
  const pageCount = pdfDoc.getPageCount();
  check('certificate PDF is a single page', pageCount === 1, `pages=${pageCount}`);

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.launch({
    userDataDir: path.join(process.env.TEMP || '.', `cert-shot-${Date.now()}`),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    headless: true,
    timeout: 120000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1123, height: 794 });
  await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const png = await page.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(OUT_DIR, 'certificate.png'), png as any);
  check('screenshot produced', (png as any).length > 1000, `bytes=${(png as any).length}`);

  const geo = await page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const seal = box(document.querySelector('.seal-area'));
    const stamp = box(document.querySelector('[style*="right:18mm"]'));
    const sig = box(document.querySelector('[style*="bottom:4px"]'));
    const overlap = (a: any, b: any) =>
      Boolean(a && b) && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
    return { seal, stamp, sig, sealStamp: overlap(seal, stamp), sealSig: overlap(seal, sig), stampSig: overlap(stamp, sig) };
  });
  check('seal and stamp do not overlap', geo.sealStamp === false, `seal=${JSON.stringify(geo.seal)} stamp=${JSON.stringify(geo.stamp)}`);
  check('seal and signature block do not overlap', geo.sealSig === false, `seal=${JSON.stringify(geo.seal)} sig=${JSON.stringify(geo.sig)}`);
  check('stamp and signature block do not overlap', geo.stampSig === false, `stamp=${JSON.stringify(geo.stamp)} sig=${JSON.stringify(geo.sig)}`);

  await browser.close();

  console.log(`\nArtifacts written to ${OUT_DIR}`);
  console.log(`\n===== RESULT: ${passed} passed, ${failed} failed =====`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('VERIFY RUNNER ERROR', err);
  process.exit(1);
});
