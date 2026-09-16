import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialAuditService } from './financial-audit.service';
import { ALLOWED_CURRENCIES } from '../constants';

export interface BankAccountInput {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  branch?: string;
  branchCode?: string;
  swiftCode?: string;
  currency?: string;
  accountType?: string;
  isActive?: boolean;
  isDefault?: boolean;
  displayOrder?: number;
  notes?: string;
}

@Injectable()
export class BankAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinancialAuditService,
  ) {}

  async list() {
    return this.prisma.bankAccount.findMany({ orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }] });
  }

  async get(id: string) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Bank account not found.');
    return account;
  }

  async create(input: BankAccountInput, userId?: string | null, userEmail?: string | null) {
    this.validate(input);
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.bankAccount.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
        }
        return tx.bankAccount.create({
          data: {
            bankName: input.bankName!,
            accountName: input.accountName!,
            accountNumber: input.accountNumber!,
            branch: input.branch,
            branchCode: input.branchCode,
            swiftCode: input.swiftCode,
            currency: input.currency || 'ZMW',
            accountType: input.accountType,
            isActive: input.isActive ?? true,
            isDefault: input.isDefault ?? false,
            displayOrder: input.displayOrder ?? 0,
            notes: input.notes,
            createdById: userId ?? undefined,
          },
        });
      });
      await this.audit.write({ action: 'CREATE', entity: 'BankAccount', entityId: account.id, userId, userEmail, newValues: { bankName: account.bankName, accountNumber: account.accountNumber } });
      return account;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('A bank account with this bank name and account number already exists.');
      throw err;
    }
  }

  async update(id: string, input: BankAccountInput, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    this.validate({ ...existing, ...input });
    try {
      const account = await this.prisma.$transaction(async (tx) => {
        if (input.isDefault) {
          await tx.bankAccount.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
        }
        return tx.bankAccount.update({
          where: { id },
          data: {
            ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
            ...(input.accountName !== undefined ? { accountName: input.accountName } : {}),
            ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber } : {}),
            ...(input.branch !== undefined ? { branch: input.branch } : {}),
            ...(input.branchCode !== undefined ? { branchCode: input.branchCode } : {}),
            ...(input.swiftCode !== undefined ? { swiftCode: input.swiftCode } : {}),
            ...(input.currency !== undefined ? { currency: input.currency } : {}),
            ...(input.accountType !== undefined ? { accountType: input.accountType } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
            ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
            ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
            ...(input.notes !== undefined ? { notes: input.notes } : {}),
            updatedById: userId ?? undefined,
          },
        });
      });
      await this.audit.write({
        action: 'UPDATE',
        entity: 'BankAccount',
        entityId: account.id,
        userId,
        userEmail,
        oldValues: { bankName: existing.bankName, accountNumber: existing.accountNumber, currency: existing.currency, isDefault: existing.isDefault },
        newValues: { bankName: account.bankName, accountNumber: account.accountNumber, currency: account.currency, isDefault: account.isDefault },
      });
      return account;
    } catch (err: any) {
      if (err?.code === 'P2002') throw new ConflictException('A bank account with this bank name and account number already exists.');
      throw err;
    }
  }

  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const account = await this.get(id);
    const quotes = await this.prisma.quotation.count({ where: { bankAccountId: id } });
    const invoices = await this.prisma.invoice.count({ where: { bankAccountId: id } });
    if (quotes > 0 || invoices > 0) {
      throw new BadRequestException('This bank account is referenced by issued documents and cannot be deleted. Deactivate it instead.');
    }
    await this.prisma.bankAccount.delete({ where: { id } });
    await this.audit.write({ action: 'DELETE', entity: 'BankAccount', entityId: id, userId, userEmail, oldValues: { bankName: account.bankName, accountNumber: account.accountNumber } });
    return { ok: true };
  }

  async getDefault(): Promise<any> {
    const account = await this.prisma.bankAccount.findFirst({ where: { isDefault: true, isActive: true } });
    if (!account) {
      return this.prisma.bankAccount.findFirst({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } });
    }
    return account;
  }

  private validate(input: BankAccountInput) {
    if (!input.bankName || !input.accountName || !input.accountNumber) {
      throw new BadRequestException('Bank name, account name and account number are required.');
    }
    if (input.currency && !ALLOWED_CURRENCIES.includes(input.currency)) {
      throw new BadRequestException(`Unsupported currency "${input.currency}". Allowed: ${ALLOWED_CURRENCIES.join(', ')}.`);
    }
    if (input.accountNumber && !/^[A-Z0-9-]{4,34}$/i.test(input.accountNumber)) {
      throw new BadRequestException('Account number must be 4-34 alphanumeric characters.');
    }
  }
}