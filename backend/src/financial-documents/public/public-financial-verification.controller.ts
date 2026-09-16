import { Controller, Get, Param } from '@nestjs/common';
import { FinancialVerificationService } from '../services/financial-verification.service';

/**
 * Public financial-document verification endpoint.
 *
 * NOTE: this controller MUST live under `public/...` because the global
 * Express auth middleware in main.ts only skips JWT for `/api/v1/public/*`.
 * No JwtAuthGuard/RolesGuard is applied here.
 */
@Controller('public/financial-verification')
export class PublicFinancialVerificationController {
  constructor(private readonly verification: FinancialVerificationService) {}

  @Get(':code')
  verify(@Param('code') code: string) {
    return this.verification.verifyPublic(code);
  }
}