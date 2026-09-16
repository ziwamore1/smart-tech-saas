import { IsBoolean, IsHexColor, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tradingName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  logoPublicId?: string;

  @IsOptional()
  @IsString()
  companyRegistrationNumber?: string;

  @IsOptional()
  @IsString()
  tpin?: string;

  @IsOptional()
  @IsString()
  zraIdentityNumber?: string;

  @IsOptional()
  @IsString()
  physicalAddress?: string;

  @IsOptional()
  @IsString()
  postalAddress?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  province?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsOptional()
  @IsObject()
  registrationInformation?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  authorizedContactName?: string;

  @IsOptional()
  @IsString()
  authorizedContactRole?: string;

  @IsOptional()
  @IsString()
  authorizedContactEmail?: string;

  @IsOptional()
  @IsString()
  authorizedContactPhone?: string;

  @IsOptional()
  @IsString()
  authorizedSignatoryName?: string;

  @IsOptional()
  @IsString()
  authorizedSignatoryRole?: string;

  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @IsOptional()
  @IsString()
  signaturePublicId?: string;

  @IsOptional()
  @IsString()
  stampUrl?: string;

  @IsOptional()
  @IsString()
  stampPublicId?: string;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  headerLayout?: string;

  @IsOptional()
  @IsString()
  footerLayout?: string;

  @IsOptional()
  @IsString()
  watermarkText?: string;

  @IsOptional()
  @IsString()
  defaultTerms?: string;

  @IsOptional()
  @IsString()
  defaultPaymentTerms?: string;

  @IsOptional()
  @IsString()
  defaultNotes?: string;

  @IsOptional()
  @IsString()
  defaultTaxConfigurationId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UploadMediaDto {
  @IsString()
  kind: 'logo' | 'signature' | 'stamp';
}