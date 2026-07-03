import { IsString, IsOptional, IsArray, IsDateString, IsBoolean, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum WhatsAppMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export class WhatsAppDocumentDto {
  @IsString()
  url: string;

  @IsString()
  filename: string;
}

export class SendWhatsAppDto {
  @IsString()
  recipient: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  templateData?: Record<string, string>;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsEnum(WhatsAppMediaType)
  mediaType?: WhatsAppMediaType;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppDocumentDto)
  document?: WhatsAppDocumentDto;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
