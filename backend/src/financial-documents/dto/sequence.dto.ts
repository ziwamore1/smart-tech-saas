import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FinancialDocumentType, FinancialSequenceResetPolicy } from '@prisma/client';
import { ALLOWED_CURRENCIES } from '../constants';

export class UpdateSequenceSettingsDto {
  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsNumber()
  @Min(3)
  sequenceLength?: number;

  @IsOptional()
  @IsString()
  separator?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  startNumber?: number;

  @IsOptional()
  @IsString()
  pattern?: string;

  @IsOptional()
  @IsEnum(FinancialSequenceResetPolicy)
  resetPolicy?: FinancialSequenceResetPolicy;
}

export class ResetSequenceDto {
  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsNumber()
  year?: number;
}

export class NumberingDefaultsDto {
  @IsOptional()
  @IsString()
  prefixQuotation?: string;

  @IsOptional()
  @IsString()
  prefixInvoice?: string;

  @IsOptional()
  @IsString()
  prefixReceipt?: string;

  @IsOptional()
  @IsNumber()
  @Min(3)
  sequenceLength?: number;

  @IsOptional()
  @IsString()
  separator?: string;

  @IsOptional()
  @IsEnum(FinancialSequenceResetPolicy)
  resetPolicy?: FinancialSequenceResetPolicy;
}

export class SettingsWriteDto {
  @IsString()
  key: string;

  @IsOptional()
  value?: any;
}

export class NextNumberDto {
  @IsEnum(FinancialDocumentType)
  documentType: FinancialDocumentType;

  @IsOptional()
  @IsString()
  prefix?: string;
}

export class CurrencySumsDto {
  @IsIn(ALLOWED_CURRENCIES)
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}