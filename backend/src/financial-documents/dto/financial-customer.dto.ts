import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { FinancialCustomerType } from '@prisma/client';

export class CreateFinancialCustomerDto {
  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsEnum(FinancialCustomerType)
  customerType?: FinancialCustomerType;

  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  address?: string;

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
  contactPerson?: string;

  @IsOptional()
  @IsString()
  billingContact?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  customerReference?: string;

  @IsOptional()
  @IsString()
  taxInformation?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}