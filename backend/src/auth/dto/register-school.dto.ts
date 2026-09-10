import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsString, IsInt, MaxLength, IsIn } from 'class-validator';

export class RegisterSchoolDto {
  @IsNotEmpty()
  schoolName: string;

  @IsNotEmpty()
  directorFirstName: string;

  @IsNotEmpty()
  directorLastName: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  institutionType?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  registrationPurpose?: string;

  @IsOptional()
  @IsInt()
  expectedLearners?: number;

  @IsOptional()
  @IsIn(['EMAIL', 'PHONE', 'WHATSAPP'])
  contactPreference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  // Honeypot field for simple automated submissions. Real users never see it.
  @IsOptional()
  @IsString()
  website?: string;
}
