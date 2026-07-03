import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString, IsUUID } from 'class-validator';

export class RegisterSuperAdminDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @MinLength(8)
  password: string;
}

export class CreateSchoolDto {
  @IsNotEmpty()
  @IsString()
  schoolName: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  schoolType?: string;
}

export class CreateDirectorDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsUUID()
  schoolId: string;
}

export class RegisterTeacherDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;
}

export class LoginDto {
  @IsNotEmpty()
  identifier: string;

  @IsNotEmpty()
  password: string;
}
