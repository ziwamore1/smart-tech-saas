import { Controller, Post, Get, Body, Param, UseGuards, Query, Logger } from '@nestjs/common';
import { MinistryGatewayService } from './ministry-gateway.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ministry')
@UseGuards(JwtAuthGuard)
export class MinistryGatewayController {
  private readonly logger = new Logger(MinistryGatewayController.name);

  constructor(private readonly ministryGatewayService: MinistryGatewayService) {}

  @Post('verify')
  async submitForVerification(@Body() body: any) {
    const result = await this.ministryGatewayService.submitForVerification(body);

    return {
      success: true,
      verification: result,
    };
  }

  @Post('status')
  async checkStatus(@Body() body: any) {
    const result = await this.ministryGatewayService.checkVerificationStatus(body);

    if (!result) {
      return { success: false, message: 'Verification record not found' };
    }

    return {
      success: true,
      verification: result,
    };
  }

  @Get('document/:documentId')
  async getDocumentVerification(@Param('documentId') documentId: string) {
    const result = await this.ministryGatewayService.getDocumentMinistryVerification(documentId);

    return {
      success: true,
      verification: result,
    };
  }

  @Get('school/all')
  async getAllVerifications() {
    const verifications = await this.ministryGatewayService.getAllVerifications();

    return {
      success: true,
      verifications,
    };
  }

  @Get('school/:schoolId')
  async getSchoolVerifications(@Param('schoolId') schoolId: string, @Query('status') status?: string) {
    const verifications = await this.ministryGatewayService.getSchoolVerifications(schoolId, status);

    return {
      success: true,
      verifications,
    };
  }

  @Post('register-institution')
  async registerInstitution(@Body() body: any) {
    const result = await this.ministryGatewayService.registerInstitution(body);

    return result;
  }

  @Get('countries')
  async getAvailableCountries() {
    const countries = this.ministryGatewayService.getAvailableCountries();

    return {
      success: true,
      countries,
    };
  }

  @Get('adapter-status')
  async getAdapterStatus() {
    const status = this.ministryGatewayService.getAdapterStatus();

    return {
      success: true,
      status,
    };
  }
}
