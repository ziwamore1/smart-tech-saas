import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FinancialCustomerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialAuditService } from './financial-audit.service';

export interface FinancialCustomerInput {
  schoolId?: string | null;
  customerType?: FinancialCustomerType;
  name?: string;
  legalName?: string;
  address?: string;
  postalAddress?: string;
  city?: string;
  province?: string;
  country?: string;
  contactPerson?: string;
  billingContact?: string;
  email?: string;
  phone?: string;
  customerReference?: string;
  taxInformation?: string;
  notes?: string;
  isActive?: boolean;
}

@Injectable()
export class FinancialCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinancialAuditService,
  ) {}

  async list(query?: { search?: string; customerType?: string; isActive?: boolean | string; page?: number; pageSize?: number }) {
    const where: any = {};
    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { legalName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { customerReference: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.customerType) where.customerType = query.customerType;
    if (query?.isActive !== undefined && query.isActive !== '') where.isActive = query.isActive === 'true' || query.isActive === true;

    const page = Math.max(1, query?.page || 1);
    const pageSize = Math.min(100, Math.max(1, query?.pageSize || 25));
    const [total, items] = await Promise.all([
      this.prisma.financialCustomer.count({ where }),
      this.prisma.financialCustomer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total, page, pageSize };
  }

  async get(id: string) {
    const customer = await this.prisma.financialCustomer.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true, registrationNumber: true } },
        _count: { select: { quotations: true, invoices: true, payments: true, receipts: true } },
      },
    });
    if (!customer) throw new NotFoundException('Financial customer not found.');
    return customer;
  }

  async create(input: FinancialCustomerInput, userId?: string | null, userEmail?: string | null) {
    this.validate(input);
    const customer = await this.prisma.financialCustomer.create({
      data: {
        schoolId: input.schoolId ?? undefined,
        customerType: input.customerType ?? FinancialCustomerType.SCHOOL,
        name: input.name!,
        legalName: input.legalName,
        address: input.address,
        postalAddress: input.postalAddress,
        city: input.city,
        province: input.province,
        country: input.country,
        contactPerson: input.contactPerson,
        billingContact: input.billingContact,
        email: input.email,
        phone: input.phone,
        customerReference: input.customerReference,
        taxInformation: input.taxInformation,
        notes: input.notes,
        isActive: input.isActive ?? true,
        createdById: userId ?? undefined,
      },
    });
    await this.audit.write({ action: 'CREATE', entity: 'FinancialCustomer', entityId: customer.id, userId, userEmail, newValues: { name: customer.name, customerType: customer.customerType } });
    return customer;
  }

  async update(id: string, input: FinancialCustomerInput, userId?: string | null, userEmail?: string | null) {
    await this.get(id);
    this.validate(input);
    const customer = await this.prisma.financialCustomer.update({
      where: { id },
      data: {
        ...(input.schoolId !== undefined ? { schoolId: input.schoolId } : {}),
        ...(input.customerType !== undefined ? { customerType: input.customerType } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.postalAddress !== undefined ? { postalAddress: input.postalAddress } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.province !== undefined ? { province: input.province } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.contactPerson !== undefined ? { contactPerson: input.contactPerson } : {}),
        ...(input.billingContact !== undefined ? { billingContact: input.billingContact } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.customerReference !== undefined ? { customerReference: input.customerReference } : {}),
        ...(input.taxInformation !== undefined ? { taxInformation: input.taxInformation } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedById: userId ?? undefined,
      },
    });
    await this.audit.write({ action: 'UPDATE', entity: 'FinancialCustomer', entityId: customer.id, userId, userEmail, newValues: { name: customer.name } });
    return customer;
  }

  /** Deletion is only allowed when the customer has no issued documents. */
  async remove(id: string, userId?: string | null, userEmail?: string | null) {
    const customer = await this.get(id);
    const totals = customer._count;
    if (totals.quotations + totals.invoices + totals.payments + totals.receipts > 0) {
      throw new BadRequestException('This customer has documents or payments and cannot be deleted. Deactivate them instead.');
    }
    await this.prisma.financialCustomer.delete({ where: { id } });
    await this.audit.write({ action: 'DELETE', entity: 'FinancialCustomer', entityId: id, userId, userEmail, oldValues: { name: customer.name } });
    return { ok: true };
  }

  private validate(input: FinancialCustomerInput) {
    if (!input.name && input.name !== undefined) throw new BadRequestException('Customer name is required.');
  }
}