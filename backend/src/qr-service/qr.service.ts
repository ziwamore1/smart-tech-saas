import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

export interface QRCodeInput {
  documentId: string;
  documentType: string;
  verificationToken: string;
  schoolId: string;
  size?: number;
  includeLogo?: boolean;
}

export interface QRCodeResult {
  qrCodeDataUrl: string;
  verificationUrl: string;
  qrCodeBuffer: Buffer;
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  private readonly VERIFICATION_URL_BASE = process.env.VERIFICATION_URL || 'https://verify.smarttechsaas.com';

  constructor(private prisma: PrismaService) {}

  async generateQRCode(input: QRCodeInput): Promise<QRCodeResult> {
    this.logger.log(`Generating QR code for document: ${input.documentId}`);

    const verificationUrl = `${this.VERIFICATION_URL_BASE}/certificate/${input.verificationToken}`;

    const qrOptions = {
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      quality: 0.95,
      margin: 2,
      width: input.size || 300,
      color: {
        dark: {
          r: 0,
          g: 51,
          b: 102,
          a: 255,
        },
        light: {
          r: 255,
          g: 255,
          b: 255,
          a: 255,
        },
      },
    };

    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, qrOptions);
    const qrCodeDataUrl = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`;

    await this.prisma.stampVerification.create({
      data: {
        documentId: input.documentId,
        documentType: input.documentType,
        schoolId: input.schoolId,
        verificationHash: input.verificationToken,
        verificationUrl,
        qrCodeDataUrl,
        metadata: {
          documentType: input.documentType,
          generatedAt: new Date().toISOString(),
          size: input.size || 300,
        },
      },
    });

    this.logger.log(`QR code generated successfully for document: ${input.documentId}`);

    return {
      qrCodeDataUrl,
      verificationUrl,
      qrCodeBuffer,
    };
  }

  async generateSimpleQRCode(url: string, size: number = 300): Promise<string> {
    const qrOptions = {
      errorCorrectionLevel: 'H' as const,
      width: size,
      margin: 2,
    };

    const qrCodeDataUrl = await QRCode.toDataURL(url, qrOptions);
    return qrCodeDataUrl;
  }

  async generateQRCodeForCertificate(
    documentId: string,
    documentType: string,
    verificationToken: string,
    schoolId: string,
  ): Promise<QRCodeResult> {
    return this.generateQRCode({
      documentId,
      documentType,
      verificationToken,
      schoolId,
    });
  }

  async getQRCodeForDocument(documentId: string): Promise<any> {
    return this.prisma.stampVerification.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateQRCode(verificationToken: string): Promise<boolean> {
    const record = await this.prisma.stampVerification.findFirst({
      where: { verificationHash: verificationToken },
    });

    return !!record;
  }
}
