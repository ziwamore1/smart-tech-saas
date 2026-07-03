import { IsString, IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';
import { CommCloudChannel } from './communication-channel.enum';

export enum RecipientType {
  ALL = 'all',
  SCHOOL = 'school',
  ROLE = 'role',
  GRADE = 'grade',
  CLASS = 'class',
  PROVINCE = 'province',
  DISTRICT = 'district',
  CUSTOM = 'custom',
}

export class BroadcastDto {
  @IsEnum(CommCloudChannel)
  channel: CommCloudChannel;

  @IsOptional()
  @IsArray()
  @IsEnum(CommCloudChannel, { each: true })
  channels?: CommCloudChannel[];

  @IsEnum(RecipientType)
  recipientType: RecipientType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipientIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  schoolIds?: string[];

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
