import { IsString, IsOptional, IsDateString, IsBoolean, IsNumber, Min, Max } from 'class-validator';

export class SendSmsDto {
  @IsString()
  recipient: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  messageType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  trackDelivery?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}
