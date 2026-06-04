import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum InstitutionTypeCodeEnum {
  PRIMARY_SCHOOL = 'PRIMARY_SCHOOL',
  SECONDARY_SCHOOL = 'SECONDARY_SCHOOL',
  ADVANCED_SECONDARY = 'ADVANCED_SECONDARY',
  COLLEGE = 'COLLEGE',
  UNIVERSITY = 'UNIVERSITY',
}

export class RegisterInstitutionDto {
  @IsNotEmpty()
  @IsString()
  institutionName: string;

  @IsNotEmpty()
  @IsEnum(InstitutionTypeCodeEnum)
  institutionType: InstitutionTypeCodeEnum;

  @IsNotEmpty()
  @IsString()
  directorFirstName: string;

  @IsNotEmpty()
  @IsString()
  directorLastName: string;

  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateInstitutionDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @IsEnum(InstitutionTypeCodeEnum)
  institutionType: InstitutionTypeCodeEnum;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  motto?: string;
}

export class AssignModulesDto {
  @IsNotEmpty()
  @IsUUID()
  institutionId: string;

  @IsNotEmpty()
  @IsString({ each: true })
  moduleCodes: string[];
}

export class AssignFeaturesDto {
  @IsNotEmpty()
  @IsUUID()
  institutionId: string;

  @IsNotEmpty()
  @IsString({ each: true })
  featureCodes: string[];
}
