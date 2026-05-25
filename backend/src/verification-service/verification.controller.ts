import { Controller, Post, Get, Body, Param, UseGuards, Logger } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('verification')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  private readonly logger = new Logger(VerificationController.name);

  constructor(private readonly verificationService: VerificationService) {}

  @Post('complete')
  async processCompleteVerification(@Body() body: any) {
    const {
      documentId,
      documentType,
      pdfBase64,
      signerId,
      signerRole,
      schoolId,
      studentName,
      studentId,
      certificateNumber,
      issueDate,
      approvalWorkflowId,
      blockchainNetwork,
      metadata,
    } = body;

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const result = await this.verificationService.processCompleteVerification({
      documentId,
      documentType,
      pdfBuffer,
      signerId,
      signerRole,
      schoolId,
      studentName,
      studentId,
      certificateNumber,
      issueDate,
      approvalWorkflowId,
      blockchainNetwork,
      metadata,
    });

    return {
      success: true,
      verificationToken: result.verificationToken,
      documentHash: result.documentHash,
      qrCodeDataUrl: result.qrCodeDataUrl,
      verificationUrl: result.verificationUrl,
      blockchainTransactionHash: result.blockchainTransactionHash,
      ministryReference: result.ministryReference,
      signedPdfBase64: result.signedPdf.toString('base64'),
    };
  }

  @Get('status/:token')
  async getFullVerificationStatus(@Param('token') token: string) {
    const status = await this.verificationService.getFullVerificationStatus(token);

    if (!status) {
      return { success: false, message: 'Verification record not found' };
    }

    return {
      success: true,
      status,
    };
  }
}
