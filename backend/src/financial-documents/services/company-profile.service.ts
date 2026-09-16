import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinancialAuditService } from './financial-audit.service';
import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { FINANCIAL_DOCUMENTS_FOLDER } from '../constants';

export interface CompanyProfileUpdateInput {
  legalName?: string;
  tradingName?: string;
  logoUrl?: string;
  logoPublicId?: string;
  companyRegistrationNumber?: string;
  tpin?: string;
  zraIdentityNumber?: string;
  physicalAddress?: string;
  postalAddress?: string;
  city?: string;
  province?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  businessDescription?: string;
  registrationInformation?: Record<string, any>;
  authorizedContactName?: string;
  authorizedContactRole?: string;
  authorizedContactEmail?: string;
  authorizedContactPhone?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryRole?: string;
  signatureUrl?: string;
  signaturePublicId?: string;
  stampUrl?: string;
  stampPublicId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  headerLayout?: string;
  footerLayout?: string;
  watermarkText?: string;
  defaultTerms?: string;
  defaultPaymentTerms?: string;
  defaultNotes?: string;
  defaultTaxConfigurationId?: string;
  isActive?: boolean;
}

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: FinancialAuditService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async get() {
    return this.prisma.companyProfile.findUnique({
      where: { id: 'company' },
      include: { defaultTaxConfiguration: true },
    });
  }

  async requireProfile() {
    const profile = await this.get();
    if (!profile) {
      throw new NotFoundException('Company profile has not been configured.');
    }
    return profile;
  }

  async exists(): Promise<boolean> {
    return !!(await this.prisma.companyProfile.findUnique({ where: { id: 'company' }, select: { id: true } }));
  }

  async update(input: CompanyProfileUpdateInput, userId?: string | null, userEmail?: string | null) {
    const previous = await this.get();
    const next = await this.prisma.companyProfile.upsert({
      where: { id: 'company' },
      create: {
        id: 'company',
        legalName: input.legalName || 'Smart Tech Solutions',
        tradingName: input.tradingName,
        logoUrl: input.logoUrl,
        logoPublicId: input.logoPublicId,
        companyRegistrationNumber: input.companyRegistrationNumber,
        tpin: input.tpin,
        zraIdentityNumber: input.zraIdentityNumber,
        physicalAddress: input.physicalAddress,
        postalAddress: input.postalAddress,
        city: input.city,
        province: input.province,
        country: input.country || 'Zambia',
        phone: input.phone,
        email: input.email,
        website: input.website,
        businessDescription: input.businessDescription,
        registrationInformation: input.registrationInformation,
        authorizedContactName: input.authorizedContactName,
        authorizedContactRole: input.authorizedContactRole,
        authorizedContactEmail: input.authorizedContactEmail,
        authorizedContactPhone: input.authorizedContactPhone,
        authorizedSignatoryName: input.authorizedSignatoryName,
        authorizedSignatoryRole: input.authorizedSignatoryRole,
        signatureUrl: input.signatureUrl,
        signaturePublicId: input.signaturePublicId,
        stampUrl: input.stampUrl,
        stampPublicId: input.stampPublicId,
        primaryColor: input.primaryColor || '#1e3a5f',
        secondaryColor: input.secondaryColor || '#c0a030',
        headerLayout: input.headerLayout || 'logo-left',
        footerLayout: input.footerLayout || 'standard',
        watermarkText: input.watermarkText,
        defaultTerms: input.defaultTerms,
        defaultPaymentTerms: input.defaultPaymentTerms,
        defaultNotes: input.defaultNotes,
        defaultTaxConfigurationId: input.defaultTaxConfigurationId,
        isActive: input.isActive ?? true,
        createdById: userId ?? undefined,
        updatedById: userId ?? undefined,
      },
      update: {
        ...(input.legalName !== undefined ? { legalName: input.legalName } : {}),
        ...(input.tradingName !== undefined ? { tradingName: input.tradingName } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.logoPublicId !== undefined ? { logoPublicId: input.logoPublicId } : {}),
        ...(input.companyRegistrationNumber !== undefined ? { companyRegistrationNumber: input.companyRegistrationNumber } : {}),
        ...(input.tpin !== undefined ? { tpin: input.tpin } : {}),
        ...(input.zraIdentityNumber !== undefined ? { zraIdentityNumber: input.zraIdentityNumber } : {}),
        ...(input.physicalAddress !== undefined ? { physicalAddress: input.physicalAddress } : {}),
        ...(input.postalAddress !== undefined ? { postalAddress: input.postalAddress } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.province !== undefined ? { province: input.province } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.businessDescription !== undefined ? { businessDescription: input.businessDescription } : {}),
        ...(input.registrationInformation !== undefined ? { registrationInformation: input.registrationInformation } : {}),
        ...(input.authorizedContactName !== undefined ? { authorizedContactName: input.authorizedContactName } : {}),
        ...(input.authorizedContactRole !== undefined ? { authorizedContactRole: input.authorizedContactRole } : {}),
        ...(input.authorizedContactEmail !== undefined ? { authorizedContactEmail: input.authorizedContactEmail } : {}),
        ...(input.authorizedContactPhone !== undefined ? { authorizedContactPhone: input.authorizedContactPhone } : {}),
        ...(input.authorizedSignatoryName !== undefined ? { authorizedSignatoryName: input.authorizedSignatoryName } : {}),
        ...(input.authorizedSignatoryRole !== undefined ? { authorizedSignatoryRole: input.authorizedSignatoryRole } : {}),
        ...(input.signatureUrl !== undefined ? { signatureUrl: input.signatureUrl } : {}),
        ...(input.signaturePublicId !== undefined ? { signaturePublicId: input.signaturePublicId } : {}),
        ...(input.stampUrl !== undefined ? { stampUrl: input.stampUrl } : {}),
        ...(input.stampPublicId !== undefined ? { stampPublicId: input.stampPublicId } : {}),
        ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
        ...(input.secondaryColor !== undefined ? { secondaryColor: input.secondaryColor } : {}),
        ...(input.headerLayout !== undefined ? { headerLayout: input.headerLayout } : {}),
        ...(input.footerLayout !== undefined ? { footerLayout: input.footerLayout } : {}),
        ...(input.watermarkText !== undefined ? { watermarkText: input.watermarkText } : {}),
        ...(input.defaultTerms !== undefined ? { defaultTerms: input.defaultTerms } : {}),
        ...(input.defaultPaymentTerms !== undefined ? { defaultPaymentTerms: input.defaultPaymentTerms } : {}),
        ...(input.defaultNotes !== undefined ? { defaultNotes: input.defaultNotes } : {}),
        ...(input.defaultTaxConfigurationId !== undefined ? { defaultTaxConfigurationId: input.defaultTaxConfigurationId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedById: userId ?? undefined,
      },
    });

    await this.audit.write({
      action: previous ? 'UPDATE' : 'CREATE',
      entity: 'CompanyProfile',
      entityId: next.id,
      userId,
      userEmail,
      oldValues: previous ? this.scrub(previous) : {},
      newValues: this.scrub(next),
    });
    return next;
  }

  async uploadMedia(buffer: Buffer, kind: 'logo' | 'signature' | 'stamp', mimeType: string, userId?: string | null) {
    const result = await this.cloudinary.uploadBuffer(buffer, {
      folder: `${FINANCIAL_DOCUMENTS_FOLDER}/media`,
      resourceType: mimeType.startsWith('image') ? 'image' : 'raw',
    });
    const map: Record<string, { url: keyof CompanyProfileUpdateInput; publicId: keyof CompanyProfileUpdateInput }> = {
      logo: { url: 'logoUrl', publicId: 'logoPublicId' },
      signature: { url: 'signatureUrl', publicId: 'signaturePublicId' },
      stamp: { url: 'stampUrl', publicId: 'stampPublicId' },
    };
    const fields = map[kind];
    const company = await this.update(
      { [fields.url]: result.secureUrl, [fields.publicId]: result.publicId } as CompanyProfileUpdateInput,
      userId,
      undefined,
    );
    return { company, upload: result };
  }

  private scrub(record: any): Record<string, any> {
    const { id, createdAt, updatedAt, createdById, updatedById, defaultTaxConfiguration, ...rest } = record;
    return rest;
  }
}