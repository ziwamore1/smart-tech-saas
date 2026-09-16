import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { FinancialDocumentType } from '@prisma/client';

export class CreateFinancialTemplateDto {
  @IsEnum(FinancialDocumentType)
  @IsOptional()
  docType?: FinancialDocumentType;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  theme?: Record<string, unknown>;

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
  @IsObject()
  components?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  legalFooter?: string;

  @IsOptional()
  @IsString()
  termsAndConditions?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}