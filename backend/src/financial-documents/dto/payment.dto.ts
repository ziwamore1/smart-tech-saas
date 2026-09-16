import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FinancialPaymentMethod, FinancialPaymentStatus } from '@prisma/client';

export class RecordPaymentDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsEnum(FinancialPaymentMethod)
  method?: FinancialPaymentMethod;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  reason?: string;
}

export class PaymentStatusUpdateDto {
  @IsEnum(FinancialPaymentStatus)
  status: FinancialPaymentStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}