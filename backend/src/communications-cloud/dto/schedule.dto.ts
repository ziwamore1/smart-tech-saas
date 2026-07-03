import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { CommCloudChannel } from './communication-channel.enum';

export class ScheduleDto {
  @IsEnum(CommCloudChannel)
  communicationType: CommCloudChannel;

  @IsString()
  recipient: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  message: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  schoolId?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}
