import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreditWalletService } from './credit-wallet.service';
import { BillingService } from './billing.service';

@Controller('communications-cloud/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly creditWalletService: CreditWalletService,
    private readonly billingService: BillingService,
  ) {}

  @Get('wallet/:ownerType/:ownerId')
  async getOrCreateWallet(
    @Param('ownerType') ownerType: string,
    @Param('ownerId') ownerId: string,
  ) {
    return this.creditWalletService.getOrCreateWallet(ownerType, ownerId);
  }

  @Get('wallet/:walletId/balance')
  async getBalance(@Param('walletId') walletId: string) {
    return this.creditWalletService.getBalance(walletId);
  }

  @Post('wallet/:walletId/recharge')
  async recharge(
    @Param('walletId') walletId: string,
    @Body() data: { channel: string; units: number; amount: number; description?: string },
  ) {
    return this.creditWalletService.addCredits(
      walletId,
      data.channel as any,
      data.units,
      data.amount,
      data.description,
    );
  }

  @Get('transactions/:walletId')
  async getTransactions(
    @Param('walletId') walletId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.creditWalletService.getTransactionHistory(
      walletId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('pricing')
  async getPricing(@Query('channel') channel?: string) {
    return this.billingService.getPricing(channel as any);
  }

  @Post('calculate-cost')
  async calculateCost(
    @Body() data: { channel: string; units: number; providerType?: string },
  ) {
    return this.billingService.calculateCost(data.channel as any, data.units, data.providerType);
  }

  @Get('invoice/:walletId')
  async generateInvoice(
    @Param('walletId') walletId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const period = { start: new Date(startDate), end: new Date(endDate) };
    return this.billingService.generateInvoice(walletId, period);
  }

  @Get('usage/:walletId')
  async getUsage(
    @Param('walletId') walletId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const period = startDate && endDate
      ? { start: new Date(startDate), end: new Date(endDate) }
      : undefined;
    return this.billingService.getUsageReport(walletId, period);
  }
}
