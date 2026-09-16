import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialTaxPricingMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialAuditService } from './financial-audit.service';

export interface TaxConfigurationInput {
  name?: string;
  taxRate?: number;
  registrationNumber?: string;
  description?: string;
  pricingMode?: FinancialTaxPricingMode;
  isActive?: boolean;
  isDefault?: boolean;
  effectiveFrom?: Date | string;
  effectiveTo?: Date | string;
}

@Injectable()
export class TaxConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinancialAuditService,
  ) {}

  async list() {
    return this.prisma.taxConfiguration.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }

  async get(id: string) {
    const tax = await this.prisma.taxConfiguration.findUnique({ where: { id } });
    if (!tax) throw new NotFoundException('Tax configuration not found.');
    return tax;
  }

  async create(input: TaxConfigurationInput, userId?: string | null, userEmail?: string | null) {
    this.validate(input);
    const tax = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxConfiguration.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.taxConfiguration.create({
        data: {
          name: input.name!,
          taxRate: input.taxRate ?? 0,
          registrationNumber: input.registrationNumber,
          description: input.description,
          pricingMode: input.pricingMode ?? FinancialTaxPricingMode.EXCLUSIVE,
          isActive: input.isActive ?? true,
          isDefault: input.isDefault ?? false,
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
          effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : undefined,
          createdById: userId ?? undefined,
        },
      });
    });
    await this.audit.write({ action: 'CREATE', entity: 'TaxConfiguration', entityId: tax.id, userId, userEmail, newValues: { name: tax.name, taxRate: tax.taxRate, pricingMode: tax.pricingMode } });
    return tax;
  }

  async update(id: string, input: TaxConfigurationInput, userId?: string | null, userEmail?: string | null) {
    const existing = await this.get(id);
    this.validate({ ...existing, ...input });
    const tax = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.taxConfiguration.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.taxConfiguration.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
          ...(input.registrationNumber !== undefined ? { registrationNumber: input.registrationNumber } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.pricingMode !== undefined ? { pricingMode: input.pricingMode } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null } : {}),
          ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null } : {}),
          updatedById: userId ?? undefined,
        },
      });
    });
    await this.audit.write({
      action: 'UPDATE',
      entity: 'TaxConfiguration',
      entityId: tax.id,
      userId,
      userEmail,
      oldValues: { name: existing.name, taxRate: existing.taxRate, pricingMode: existing.pricingMode },
      newValues: { name: tax.name, taxRate: tax.taxRate, pricingMode: tax.pricingMode },
    });
    return tax;
  }

  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const tax = await this.get(id);
    const quotes = await this.prisma.quotation.count({ where: { taxConfigurationId: id } });
    const invoices = await this.prisma.invoice.count({ where: { taxConfigurationId: id } });
    if (quotes > 0 || invoices > 0) {
      throw new BadRequestException('This tax configuration is referenced by issued documents and cannot be deleted. Deactivate it instead.');
    }
    await this.prisma.taxConfiguration.delete({ where: { id } });
    await this.audit.write({ action: 'DELETE', entity: 'TaxConfiguration', entityId: id, userId, userEmail, oldValues: { name: tax.name, taxRate: tax.taxRate } });
    return { ok: true };
  }

  async getDefault() {
    return this.prisma.taxConfiguration.findFirst({ where: { isDefault: true, isActive: true } });
  }

  private validate(input: TaxConfigurationInput) {
    if (!input.name) throw new BadRequestException('Tax configuration name is required.');
    if (input.taxRate !== undefined && (input.taxRate < 0 || input.taxRate > 100)) {
      throw new BadRequestException('Tax rate must be between 0 and 100.');
    }
  }
}