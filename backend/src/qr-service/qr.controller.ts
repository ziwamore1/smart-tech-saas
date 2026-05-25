import { Controller, Post, Get, Body, Param, UseGuards, Logger } from '@nestjs/common';
import { QrService } from './qr.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('qr')
@UseGuards(JwtAuthGuard)
export class QrController {
  private readonly logger = new Logger(QrController.name);

  constructor(private readonly qrService: QrService) {}

  @Post('generate')
  async generateQRCode(@Body() body: any) {
    const { documentId, documentType, verificationToken, schoolId, size } = body;

    const result = await this.qrService.generateQRCode({
      documentId,
      documentType,
      verificationToken,
      schoolId,
      size,
    });

    return {
      success: true,
      qrCodeDataUrl: result.qrCodeDataUrl,
      verificationUrl: result.verificationUrl,
    };
  }

  @Post('simple')
  async generateSimpleQRCode(@Body() body: any) {
    const { url, size } = body;
    const qrCodeDataUrl = await this.qrService.generateSimpleQRCode(url, size);

    return {
      success: true,
      qrCodeDataUrl,
    };
  }

  @Get('document/:documentId')
  async getDocumentQRCode(@Param('documentId') documentId: string) {
    const qrCode = await this.qrService.getQRCodeForDocument(documentId);

    return {
      success: true,
      qrCode,
    };
  }

  @Get('validate/:token')
  async validateQRCode(@Param('token') token: string) {
    const isValid = await this.qrService.validateQRCode(token);

    return {
      success: true,
      valid: isValid,
    };
  }
}
