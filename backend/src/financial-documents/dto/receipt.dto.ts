import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IssueReceiptDto {
  @IsString()
  @IsNotEmpty()
  paymentId: string;
}

export class VoidOrCancelDto {
  @IsOptional()
  @IsString()
  reason?: string;
}