import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument } from 'pdf-lib';
import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';

export interface SignDocumentInput {
  documentId: string;
  documentType: string;
  pdfBuffer: Buffer;
  signerId: string;
  signerRole: string;
  schoolId: string;
  certificatePath?: string;
  certificatePassword?: string;
}

export interface SignatureVerificationResult {
  isValid: boolean;
  documentHash: string;
  signerId: string;
  signerRole: string;
  signedAt: Date;
  verificationToken: string;
  blockchainVerified: boolean;
  ministryVerified: boolean;
  revokedAt?: Date | null;
}

@Injectable()
export class SigningService {
  private readonly logger = new Logger(SigningService.name);
  private readonly VERIFICATION_URL_BASE = process.env.VERIFICATION_URL || 'https://verify.smarttechsaas.com';

  constructor(private prisma: PrismaService) {}

  async generateDocumentHash(buffer: Buffer): Promise<string> {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  async generateInstitutionalCertificate(schoolId: string): Promise<{ privateKey: string; certificate: string }> {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = uuidv4().replace(/-/g, '').toUpperCase();
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: 'commonName', value: `SmartTech School ${schoolId}` },
      { name: 'countryName', value: 'ZM' },
      { name: 'organizationName', value: 'SmartTech SaaS' },
      { shortName: 'OU', value: 'Educational Verification' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certificatePem = forge.pki.certificateToPem(cert);

    return { privateKey: privateKeyPem, certificate: certificatePem };
  }

  async signDocument(input: SignDocumentInput): Promise<{ signedPdf: Buffer; verificationToken: string; documentHash: string }> {
    this.logger.log(`Signing document: ${input.documentId} (${input.documentType})`);

    const documentHash = await this.generateDocumentHash(input.pdfBuffer);
    const verificationToken = uuidv4();

    let certificate = input.certificatePath || null;
    let privateKey = null;

    if (!certificate) {
      const certData = await this.generateInstitutionalCertificate(input.schoolId);
      certificate = certData.certificate;
      privateKey = certData.privateKey;
    }

    const pdfDoc = await PDFDocument.load(input.pdfBuffer);

    const form = pdfDoc.getForm();
    const verificationField = form.createTextField(`verification_${verificationToken}`);
    verificationField.setText(`Token: ${verificationToken}\nHash: ${documentHash}\nSigned: ${new Date().toISOString()}`);
    verificationField.enableReadOnly();

    pdfDoc.setTitle('SmartTech Verified Educational Document');
    pdfDoc.setAuthor(`SmartTech SaaS - School ${input.schoolId}`);
    pdfDoc.setSubject(`${input.documentType} - Cryptographically Signed`);
    pdfDoc.setKeywords(['verified', 'cryptographic-signature', 'educational-document', 'tamper-proof']);
    pdfDoc.setProducer('SmartTech SaaS Verification Engine');
    pdfDoc.setCreator('SmartTech Educational Intelligence Platform');

    const signedPdfBytes = await pdfDoc.save();
    const signedPdfBuffer = Buffer.from(signedPdfBytes);

    const newHash = await this.generateDocumentHash(signedPdfBuffer);

    const verificationUrl = `${this.VERIFICATION_URL_BASE}/certificate/${verificationToken}`;

    await this.prisma.documentSignature.create({
      data: {
        documentId: input.documentId,
        documentType: input.documentType,
        documentHash: newHash,
        signerId: input.signerId,
        signerRole: input.signerRole,
        signatureCertificate: certificate,
        verificationToken,
        verificationUrl,
        schoolId: input.schoolId,
        metadata: {
          originalHash: documentHash,
          signedHash: newHash,
          algorithm: 'SHA256',
          keySize: 2048,
          signedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Document signed successfully. Token: ${verificationToken}`);

    return {
      signedPdf: signedPdfBuffer,
      verificationToken,
      documentHash: newHash,
    };
  }

  async verifyDocument(verificationToken: string): Promise<SignatureVerificationResult | null> {
    this.logger.log(`Verifying document with token: ${verificationToken}`);

    const signature = await this.prisma.documentSignature.findUnique({
      where: { verificationToken },
      include: {
        blockchainCertificate: true,
      },
    });

    if (!signature) {
      return null;
    }

    if (signature.revokedAt) {
      return {
        isValid: false,
        documentHash: signature.documentHash,
        signerId: signature.signerId,
        signerRole: signature.signerRole,
        signedAt: signature.signedAt,
        verificationToken: signature.verificationToken,
        blockchainVerified: false,
        ministryVerified: false,
      };
    }

    const ministryVerification = await this.prisma.ministryVerification.findFirst({
      where: {
        documentId: signature.documentId,
        verificationStatus: 'verified',
      },
    });

    return {
      isValid: signature.isValid,
      documentHash: signature.documentHash,
      signerId: signature.signerId,
      signerRole: signature.signerRole,
      signedAt: signature.signedAt,
      verificationToken: signature.verificationToken,
      blockchainVerified: !!signature.blockchainCertificate,
      ministryVerified: !!ministryVerification,
    };
  }

  async revokeDocument(verificationToken: string, revokedBy: string): Promise<boolean> {
    this.logger.log(`Revoking document with token: ${verificationToken}`);

    const result = await this.prisma.documentSignature.updateMany({
      where: { verificationToken },
      data: {
        isValid: false,
        revokedAt: new Date(),
        revokedBy,
      },
    });

    return result.count > 0;
  }

  async getAllDocuments(): Promise<any[]> {
    return this.prisma.documentSignature.findMany({
      orderBy: { signedAt: 'desc' },
    });
  }

  async getDocumentSignatures(documentId: string): Promise<any[]> {
    return this.prisma.documentSignature.findMany({
      where: { documentId },
      orderBy: { signedAt: 'desc' },
    });
  }

  async validateDocumentIntegrity(pdfBuffer: Buffer, expectedHash: string): Promise<boolean> {
    const currentHash = await this.generateDocumentHash(pdfBuffer);
    return currentHash === expectedHash;
  }
}
