import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateStaffTransferDto {
  @IsString()
  profileId: string;

  @IsString()
  transferType: string;

  @IsString()
  fromSchoolId: string;

  @IsString()
  toSchoolId: string;

  @IsOptional()
  @IsString()
  fromDistrict?: string;

  @IsOptional()
  @IsString()
  toDistrict?: string;

  @IsOptional()
  @IsString()
  fromProvince?: string;

  @IsOptional()
  @IsString()
  toProvince?: string;

  @IsDateString()
  transferDate: string;

  @IsDateString()
  effectiveDate: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
