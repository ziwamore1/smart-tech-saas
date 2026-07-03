import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditWalletService } from './credit-wallet.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

interface PricingInfo {
  providerId: string;
  providerName: string;
  providerType: string;
  costPerMessage: number;
  currency: string;
  isActive: boolean;
  status: string;
  successRate: number;
}

interface UsageReportEntry {
  channel: CommCloudChannel;
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  totalCost: number;
  currency: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private creditWalletService: CreditWalletService,
  ) {}

  async calculateCost(channel: CommCloudChannel, units: number, providerType?: string) {
    const where: any = { channel, isActive: true, status: 'active' };
    if (providerType) where.providerType = providerType;

    const provider = await this.prisma.commCloudProvider.findFirst({
      where,
      orderBy: { priority: 'asc' },
    });

    if (!provider) {
      throw new NotFoundException(`No active provider found for channel ${channel}`);
    }

    const costPerUnit = provider.costPerMessage;
    const totalCost = costPerUnit * units;

    return {
      channel,
      units,
      costPerUnit,
      totalCost,
      currency: provider.currency,
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.providerType,
    };
  }

  async processPayment(walletId: string, amount: number, description: string) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    const newBalance = wallet.prepaidBalance - amount;

    const [updated, transaction] = await Promise.all([
      this.prisma.commCloudCreditWallet.update({
        where: { id: walletId },
        data: { prepaidBalance: newBalance },
      }),
      this.prisma.commCloudBillingTransaction.create({
        data: {
          walletId,
          transactionType: 'debit',
          amount,
          currency: wallet.currency,
          balanceBefore: wallet.prepaidBalance,
          balanceAfter: newBalance,
          description,
          status: 'completed',
        },
      }),
    ]);

    this.logger.log(`Payment of ${amount} ${wallet.currency} processed from wallet ${walletId}`);

    return { transaction, remainingBalance: newBalance };
  }

  async generateInvoice(walletId: string, period: { start: Date; end: Date }) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    const transactions = await this.prisma.commCloudBillingTransaction.findMany({
      where: {
        walletId,
        createdAt: { gte: period.start, lte: period.end },
      },
      orderBy: { createdAt: 'asc' },
    });

    const debits = transactions.filter(t => t.transactionType === 'debit');
    const credits = transactions.filter(t => t.transactionType === 'credit' || t.transactionType === 'recharge');
    const totalDebits = debits.reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = credits.reduce((sum, t) => sum + t.amount, 0);

    const usageByChannel = await this.getUsageReport(walletId, period);

    return {
      walletId,
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      period,
      generatedAt: new Date(),
      summary: {
        totalTransactions: transactions.length,
        totalDebits,
        totalCredits,
        netBalance: totalCredits - totalDebits,
        currentPrepaidBalance: wallet.prepaidBalance,
        currency: wallet.currency,
      },
      usageByChannel,
      recentTransactions: transactions.slice(-20),
    };
  }

  async getPricing(channel?: CommCloudChannel): Promise<PricingInfo[] | PricingInfo> {
    const where: any = { isActive: true };
    if (channel) where.channel = channel;

    const providers = await this.prisma.commCloudProvider.findMany({
      where,
      orderBy: [{ channel: 'asc' }, { priority: 'asc' }],
    });

    return providers.map(p => ({
      providerId: p.id,
      providerName: p.name,
      providerType: p.providerType,
      costPerMessage: p.costPerMessage,
      currency: p.currency,
      isActive: p.isActive,
      status: p.status,
      successRate: p.successRate,
    })) as any;
  }

  async getUsageReport(walletId: string, period?: { start: Date; end: Date }): Promise<UsageReportEntry[]> {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    const dateFilter = period
      ? { createdAt: { gte: period.start, lte: period.end } }
      : {};

    const channels: CommCloudChannel[] = ['SMS', 'EMAIL', 'WHATSAPP', 'PUSH'];

    const reports = await Promise.all(
      channels.map(async channel => {
        const where = { ...dateFilter, walletId, channel };

        const [totalSent, totalDelivered, totalFailed, costData] = await Promise.all([
          this.prisma.commCloudBillingTransaction.count({
            where: { ...where, transactionType: 'debit' },
          }),
          this.prisma.commCloudBillingTransaction.count({
            where: { ...where, transactionType: 'debit' },
          }),
          this.prisma.commCloudBillingTransaction.count({
            where: { ...where, transactionType: 'debit' },
          }),
          this.prisma.commCloudBillingTransaction.aggregate({
            where: { ...where, transactionType: 'debit' },
            _sum: { amount: true },
          }),
        ]);

        return {
          channel,
          totalSent,
          totalDelivered,
          totalFailed,
          totalCost: costData._sum.amount || 0,
          currency: wallet.currency,
        };
      }),
    );

    return reports;
  }
}
