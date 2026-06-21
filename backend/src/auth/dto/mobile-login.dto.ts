import { IsEmail, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class MobileLoginDto {
  @ValidateIf(o => !o.username)
  @IsEmail()
  @IsNotEmpty()
  email?: string;

  @ValidateIf(o => !o.email)
  @IsString()
  @IsNotEmpty()
  username?: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  deviceToken?: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  platform?: string;
}
