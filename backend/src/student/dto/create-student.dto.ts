import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export const StudentStatusValues = [
  'ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED',
  'WITHDRAWN', 'SUSPENDED', 'DECEASED',
] as const;

export type StudentStatusType = typeof StudentStatusValues[number];

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  admissionNumber?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  parentName?: string;

  @IsString()
  @IsOptional()
  parentPhone?: string;

  @IsString()
  @IsOptional()
  parentEmail?: string;

  @IsString()
  @IsOptional()
  linkingParentId?: string;

  @IsString()
  @IsOptional()
  academicYearId?: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsBoolean()
  @IsOptional()
  manualOverride?: boolean;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  className?: string;
}
