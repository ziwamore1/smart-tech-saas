import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateStaffReturnDto {
  @IsString()
  profileId: string;

  @IsString()
  returnType: string;

  @IsString()
  period: string;

  @IsObject()
  data: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
