import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';
import { CommCloudChannel } from './communication-channel.enum';

export class CommunicationResponseDto {
  @IsString()
  id: string;

  @IsString()
  channel: CommCloudChannel;

  @IsString()
  status: string;

  @IsString()
  recipient: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsNumber()
  cost?: number;

  @IsDateString()
  createdAt: string;
}
