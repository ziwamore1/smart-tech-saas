import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

@Injectable()
export class CreditWalletService {
  private readonly logger = new Logger(CreditWalletService.name);

  constructor(private prisma: PrismaService) {}

  private channelBalanceField(channel: CommCloudChannel): string {
    const map: Record<CommCloudChannel, string> = {
      SMS: 'smsBalance',
      EMAIL: 'emailBalance',
      WHATSAPP: 'whatsappBalance',
      PUSH: 'pushBalance',
      IN_APP: 'pushBalance',
    };
    return map[channel] || 'smsBalance';
  }

  async getOrCreateWallet(ownerType: string, ownerId: string) {
    let wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { ownerType_ownerId: { ownerType, ownerId } },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });

    if (!wallet) {
      wallet = await this.prisma.commCloudCreditWallet.create({
        data: { ownerType, ownerId },
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 10 } },
      });
      this.logger.log(`Created wallet ${wallet.id} for ${ownerType}:${ownerId}`);
    }

    return wallet;
  }

  async getBalance(walletId: string) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    return {
      walletId: wallet.id,
      ownerType: wallet.ownerType,
      ownerId: wallet.ownerId,
      balances: {
        SMS: wallet.smsBalance,
        EMAIL: wallet.emailBalance,
        WHATSAPP: wallet.whatsappBalance,
        PUSH: wallet.pushBalance,
      },
      prepaidBalance: wallet.prepaidBalance,
      currency: wallet.currency,
      monthlyLimit: wallet.monthlyLimit,
      overageAllowed: wallet.overageAllowed,
      isActive: wallet.isActive,
    };
  }

  async deductCredits(walletId: string, channel: CommCloudChannel, units: number, cost: number) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);
    if (!wallet.isActive) throw new BadRequestException('Wallet is deactivated');

    const balanceField = this.channelBalanceField(channel);
    const currentBalance = (wallet as any)[balanceField] as number;

    if (currentBalance < units) {
      throw new BadRequestException(
        `Insufficient ${channel} credits: ${currentBalance} available, ${units} required`,
      );
    }

    const newBalance = currentBalance - units;
    const newPrepaid = wallet.prepaidBalance - cost;

    const [updated] = await Promise.all([
      this.prisma.commCloudCreditWallet.update({
        where: { id: walletId },
        data: {
          [balanceField]: newBalance,
          prepaidBalance: newPrepaid,
        },
      }),
      this.prisma.commCloudBillingTransaction.create({
        data: {
          walletId,
          transactionType: 'debit',
          channel,
          units,
          amount: cost,
          currency: wallet.currency,
          balanceBefore: wallet.prepaidBalance,
          balanceAfter: newPrepaid,
          description: `Debit ${units} ${channel} credits (${cost} ${wallet.currency})`,
          status: 'completed',
        },
      }),
    ]);

    this.logger.log(`Deducted ${units} ${channel} credits from wallet ${walletId}`);

    return {
      remaining: newBalance,
      remainingPrepaid: newPrepaid,
      channel,
      unitsDeducted: units,
      cost,
    };
  }

  async addCredits(
    walletId: string,
    channel: CommCloudChannel,
    units: number,
    amount: number,
    description?: string,
  ) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    const balanceField = this.channelBalanceField(channel);
    const currentBalance = (wallet as any)[balanceField] as number;
    const newBalance = currentBalance + units;
    const newPrepaid = wallet.prepaidBalance + amount;

    const [updated] = await Promise.all([
      this.prisma.commCloudCreditWallet.update({
        where: { id: walletId },
        data: {
          [balanceField]: newBalance,
          prepaidBalance: newPrepaid,
        },
      }),
      this.prisma.commCloudBillingTransaction.create({
        data: {
          walletId,
          transactionType: 'recharge',
          channel,
          units,
          amount,
          currency: wallet.currency,
          balanceBefore: wallet.prepaidBalance,
          balanceAfter: newPrepaid,
          description: description || `Recharge ${units} ${channel} credits (${amount} ${wallet.currency})`,
          status: 'completed',
        },
      }),
    ]);

    this.logger.log(`Added ${units} ${channel} credits to wallet ${walletId}`);

    return {
      newBalance,
      newPrepaid,
      channel,
      unitsAdded: units,
      amount,
    };
  }

  async getTransactionHistory(walletId: string, limit = 50, offset = 0) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) throw new NotFoundException(`Wallet ${walletId} not found`);

    const [transactions, total] = await Promise.all([
      this.prisma.commCloudBillingTransaction.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.commCloudBillingTransaction.count({ where: { walletId } }),
    ]);

    return { transactions, total, limit, offset };
  }

  async hasSufficientCredits(walletId: string, channel: CommCloudChannel, units: number) {
    const wallet = await this.prisma.commCloudCreditWallet.findUnique({
      where: { id: walletId },
    });
    if (!wallet) return false;
    if (!wallet.isActive) return false;

    const balanceField = this.channelBalanceField(channel);
    const currentBalance = (wallet as any)[balanceField] as number;

    if (currentBalance >= units) return true;

    return !!(wallet.overageAllowed && wallet.monthlyLimit);
  }
}
