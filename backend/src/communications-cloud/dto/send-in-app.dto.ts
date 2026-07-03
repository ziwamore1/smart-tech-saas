import { IsString, IsOptional, IsArray } from 'class-validator';

export class SendInAppDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  data?: Record<string, any>;

  @IsOptional()
  @IsString()
  schoolId?: string;
}
