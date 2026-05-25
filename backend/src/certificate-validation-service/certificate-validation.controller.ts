import { Controller, Get, Param, UseGuards, Logger } from '@nestjs/common';
import { CertificateValidationService } from './certificate-validation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('certificate-validation')
@UseGuards(JwtAuthGuard)
export class CertificateValidationController {
  private readonly logger = new Logger(CertificateValidationController.name);

  constructor(private readonly validationService: CertificateValidationService) {}

  @Get('verify/:token')
  async verifyCertificate(@Param('token') token: string) {
    const result = await this.validationService.verifyCertificate(token);

    if (!result) {
      return { success: false, message: 'Certificate not found or invalid' };
    }

    return {
      success: true,
      verification: result,
    };
  }

  @Get('document/:documentId')
  async verifyByDocumentId(@Param('documentId') documentId: string) {
    const result = await this.validationService.verifyByDocumentId(documentId);

    if (!result) {
      return { success: false, message: 'Document not found' };
    }

    return {
      success: true,
      verification: result,
    };
  }

  @Get('stats/:schoolId')
  async getVerificationStats(@Param('schoolId') schoolId: string) {
    const stats = await this.validationService.getVerificationStats(schoolId);

    return {
      success: true,
      stats,
    };
  }
}
