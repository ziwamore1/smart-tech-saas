import { IsString, IsOptional, IsArray, IsEmail, IsDateString, IsBoolean, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class EmailAttachmentDto {
  @IsString()
  filename: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class SendEmailDto {
  @IsOptional()
  @IsEmail()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsEmail()
  @IsString()
  to?: string;

  getRecipient(): string {
    return this.recipient || this.to || '';
  }

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bcc?: string[];

  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderEmail?: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailAttachmentDto)
  attachments?: EmailAttachmentDto[];

  @IsOptional()
  @IsBoolean()
  trackOpens?: boolean;

  @IsOptional()
  @IsBoolean()
  trackClicks?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}
