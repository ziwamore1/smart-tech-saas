import { IsString, IsOptional, IsInt, IsBoolean } from 'class-validator';

export class CreateStaffQualificationDto {
  @IsString()
  profileId: string;

  @IsString()
  qualificationType: string;

  @IsString()
  qualificationName: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsInt()
  yearObtained?: number;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  documentUrl?: string;
}
