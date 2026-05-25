import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SigningService } from '../signing-service/signing.service';
import { BlockchainService } from '../blockchain-service/blockchain.service';
import { QrService } from '../qr-service/qr.service';
import { MinistryGatewayService } from '../ministry-gateway/ministry-gateway.service';

export interface CompleteDocumentVerificationInput {
  documentId: string;
  documentType: string;
  pdfBuffer: Buffer;
  signerId: string;
  signerRole: string;
  schoolId: string;
  studentName?: string;
  studentId?: string;
  certificateNumber?: string;
  issueDate?: string;
  approvalWorkflowId?: string;
  blockchainNetwork?: string;
  metadata?: Record<string, any>;
}

export interface CompleteVerificationResult {
  signedPdf: Buffer;
  verificationToken: string;
  documentHash: string;
  qrCodeDataUrl: string;
  verificationUrl: string;
  blockchainTransactionHash?: string;
  ministryReference?: string;
  approvalWorkflowId?: string;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private signingService: SigningService,
    private blockchainService: BlockchainService,
    private qrService: QrService,
    private ministryGatewayService: MinistryGatewayService,
  ) {}

  async processCompleteVerification(input: CompleteDocumentVerificationInput): Promise<CompleteVerificationResult> {
    this.logger.log(`Processing complete verification for document: ${input.documentId}`);

    const { signedPdf, verificationToken, documentHash } = await this.signingService.signDocument({
      documentId: input.documentId,
      documentType: input.documentType,
      pdfBuffer: input.pdfBuffer,
      signerId: input.signerId,
      signerRole: input.signerRole,
      schoolId: input.schoolId,
    });

    const { qrCodeDataUrl, verificationUrl } = await this.qrService.generateQRCodeForCertificate(
      input.documentId,
      input.documentType,
      verificationToken,
      input.schoolId,
    );

    const documentSignature = await this.prisma.documentSignature.findUnique({
      where: { verificationToken },
    });

    let blockchainTransactionHash: string | undefined;
    let ministryReference: string | undefined;

    try {
      const blockchainResult = await this.blockchainService.certifyDocument({
        documentId: input.documentId,
        documentSignatureId: documentSignature.id,
        certificateHash: documentHash,
        schoolId: input.schoolId,
        network: input.blockchainNetwork,
      });

      blockchainTransactionHash = blockchainResult.transactionHash;
    } catch (error) {
      this.logger.error(`Blockchain certification failed: ${error.message}`);
    }

    try {
      const ministryResult = await this.ministryGatewayService.submitForVerification({
        documentId: input.documentId,
        documentType: input.documentType,
        schoolId: input.schoolId,
        studentName: input.studentName,
        studentId: input.studentId,
        certificateNumber: input.certificateNumber,
        issueDate: input.issueDate,
        metadata: input.metadata,
      });

      ministryReference = ministryResult.ministryReference;
    } catch (error) {
      this.logger.error(`Ministry verification failed: ${error.message}`);
    }

    this.logger.log(`Complete verification processed for document: ${input.documentId}`);

    return {
      signedPdf,
      verificationToken,
      documentHash,
      qrCodeDataUrl,
      verificationUrl,
      blockchainTransactionHash,
      ministryReference,
      approvalWorkflowId: input.approvalWorkflowId,
    };
  }

  async getFullVerificationStatus(verificationToken: string): Promise<any> {
    const signature = await this.prisma.documentSignature.findUnique({
      where: { verificationToken },
      include: {
        blockchainCertificate: true,
      },
    });

    if (!signature) {
      return null;
    }

    const ministryVerification = await this.prisma.ministryVerification.findFirst({
      where: { documentId: signature.documentId },
      orderBy: { createdAt: 'desc' },
    });

    const approvalWorkflow = await this.prisma.approvalWorkflow.findFirst({
      where: { documentId: signature.documentId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    const qrCode = await this.prisma.stampVerification.findFirst({
      where: { documentId: signature.documentId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      signature: {
        isValid: signature.isValid,
        signerId: signature.signerId,
        signerRole: signature.signerRole,
        signedAt: signature.signedAt,
        documentHash: signature.documentHash,
        revokedAt: signature.revokedAt,
      },
      blockchain: signature.blockchainCertificate,
      ministry: ministryVerification,
      approvals: approvalWorkflow,
      qrCode,
      verificationUrl: signature.verificationUrl,
    };
  }
}
