import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QuotationStatus } from '@prisma/client';

export class TransitionQuotationDto {
  @IsEnum(QuotationStatus)
  to: QuotationStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class QuotationConvertDto {
  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  orderReference?: string;

  @IsOptional()
  @IsString()
  purchaseReference?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  serviceTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  templateId?: string;
}