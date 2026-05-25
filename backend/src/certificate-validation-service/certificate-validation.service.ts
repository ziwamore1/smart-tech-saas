import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SigningService } from '../signing-service/signing.service';
import { BlockchainService } from '../blockchain-service/blockchain.service';
import { MinistryGatewayService } from '../ministry-gateway/ministry-gateway.service';

export interface FullVerificationResult {
  documentId: string;
  documentType: string;
  schoolName: string;
  studentName?: string;
  issueDate?: string;
  signatureValid: boolean;
  blockchainVerified: boolean;
  ministryVerified: boolean;
  approvalChainComplete: boolean;
  overallStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'UNVERIFIED' | 'INVALID';
  verificationDetails: {
    signature: any;
    blockchain: any;
    ministry: any;
    approvals: any;
  };
  verifiedAt: Date;
}

@Injectable()
export class CertificateValidationService {
  private readonly logger = new Logger(CertificateValidationService.name);

  constructor(
    private prisma: PrismaService,
    private signingService: SigningService,
    private blockchainService: BlockchainService,
    private ministryGatewayService: MinistryGatewayService,
  ) {}

  async verifyCertificate(verificationToken: string): Promise<FullVerificationResult | null> {
    this.logger.log(`Full certificate verification for token: ${verificationToken}`);

    const signature = await this.signingService.verifyDocument(verificationToken);

    if (!signature) {
      return null;
    }

    const documentSignature = await this.prisma.documentSignature.findUnique({
      where: { verificationToken },
    });

    if (!documentSignature) {
      return null;
    }

    const school = await this.prisma.school.findUnique({
      where: { id: documentSignature.schoolId },
    });

    const blockchainCert = await this.blockchainService.getBlockchainCertificate(documentSignature.documentId);
    const ministryVerification = await this.ministryGatewayService.getDocumentMinistryVerification(documentSignature.documentId);

    const approvalWorkflow = await this.prisma.approvalWorkflow.findFirst({
      where: {
        documentId: documentSignature.documentId,
        status: 'completed',
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    const signatureValid = signature.isValid && !signature.revokedAt;
    const blockchainVerified = signature.blockchainVerified || !!blockchainCert;
    const ministryVerified = signature.ministryVerified || (ministryVerification?.verificationStatus === 'verified');
    const approvalChainComplete = !!approvalWorkflow && approvalWorkflow.steps.every((step) => step.status === 'approved');

    let overallStatus: FullVerificationResult['overallStatus'];

    if (!signatureValid) {
      overallStatus = 'INVALID';
    } else if (signatureValid && blockchainVerified && ministryVerified && approvalChainComplete) {
      overallStatus = 'VERIFIED';
    } else if (signatureValid && (blockchainVerified || ministryVerified || approvalChainComplete)) {
      overallStatus = 'PARTIALLY_VERIFIED';
    } else {
      overallStatus = 'UNVERIFIED';
    }

    return {
      documentId: documentSignature.documentId,
      documentType: documentSignature.documentType,
      schoolName: school?.name || 'Unknown Institution',
      signatureValid,
      blockchainVerified,
      ministryVerified,
      approvalChainComplete,
      overallStatus,
      verificationDetails: {
        signature: {
          signerId: signature.signerId,
          signerRole: signature.signerRole,
          signedAt: signature.signedAt,
          documentHash: signature.documentHash,
          isValid: signatureValid,
        },
        blockchain: blockchainCert
          ? {
              network: blockchainCert.blockchainNetwork,
              transactionHash: blockchainCert.transactionHash,
              verificationUrl: blockchainCert.verificationUrl,
            }
          : null,
        ministry: ministryVerification
          ? {
              status: ministryVerification.verificationStatus,
              reference: ministryVerification.ministryReference,
              verifiedAt: ministryVerification.verifiedAt,
            }
          : null,
        approvals: approvalWorkflow
          ? {
              status: approvalWorkflow.status,
              currentStep: approvalWorkflow.currentStep,
              totalSteps: approvalWorkflow.steps.length,
              steps: approvalWorkflow.steps.map((step) => ({
                role: step.role,
                status: step.status,
                completedAt: step.completedAt,
              })),
            }
          : null,
      },
      verifiedAt: new Date(),
    };
  }

  async verifyByDocumentId(documentId: string): Promise<FullVerificationResult | null> {
    const signature = await this.prisma.documentSignature.findFirst({
      where: { documentId },
      orderBy: { signedAt: 'desc' },
    });

    if (!signature) {
      return null;
    }

    return this.verifyCertificate(signature.verificationToken);
  }

  async getVerificationStats(schoolId: string): Promise<any> {
    const totalDocuments = await this.prisma.documentSignature.count({
      where: { schoolId },
    });

    const verifiedDocuments = await this.prisma.documentSignature.count({
      where: {
        schoolId,
        isValid: true,
        blockchainHash: { not: null },
      },
    });

    const ministryVerified = await this.prisma.ministryVerification.count({
      where: {
        schoolId,
        verificationStatus: 'verified',
      },
    });

    const blockchainCertificates = await this.prisma.blockchainCertificate.count({
      where: {
        documentSignature: {
          schoolId,
        },
      },
    });

    return {
      totalDocuments,
      verifiedDocuments,
      ministryVerified,
      blockchainCertificates,
      verificationRate: totalDocuments > 0 ? ((verifiedDocuments / totalDocuments) * 100).toFixed(2) + '%' : '0%',
    };
  }
}
