import { Controller, Post, Get, Body, Param, UseGuards, Req, Logger } from '@nestjs/common';
import { SigningService } from './signing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('signing')
@UseGuards(JwtAuthGuard)
export class SigningController {
  private readonly logger = new Logger(SigningController.name);

  constructor(private readonly signingService: SigningService) {}

  @Post('sign')
  async signDocument(@Body() body: any, @Req() req: any) {
    const { documentId, documentType, pdfBase64, schoolId } = body;
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    const result = await this.signingService.signDocument({
      documentId,
      documentType,
      pdfBuffer,
      signerId: req.user.id,
      signerRole: req.user.role,
      schoolId,
    });

    return {
      success: true,
      verificationToken: result.verificationToken,
      documentHash: result.documentHash,
      signedPdfBase64: result.signedPdf.toString('base64'),
    };
  }

  @Get('verify/:token')
  async verifyDocument(@Param('token') token: string) {
    const result = await this.signingService.verifyDocument(token);

    if (!result) {
      return { success: false, message: 'Document not found or invalid token' };
    }

    return {
      success: true,
      verification: result,
    };
  }

  @Post('revoke/:token')
  async revokeDocument(@Param('token') token: string, @Req() req: any) {
    const result = await this.signingService.revokeDocument(token, req.user.id);

    return {
      success: result,
      message: result ? 'Document revoked successfully' : 'Failed to revoke document',
    };
  }

  @Get('document/:documentId')
  async getDocumentSignatures(@Param('documentId') documentId: string) {
    const signatures = await this.signingService.getDocumentSignatures(documentId);

    return {
      success: true,
      signatures,
    };
  }

  @Post('generate-certificate')
  async generateCertificate(@Body() body: any) {
    const { schoolId } = body;
    const cert = await this.signingService.generateInstitutionalCertificate(schoolId);

    return {
      success: true,
      certificate: cert.certificate,
    };
  }
}
