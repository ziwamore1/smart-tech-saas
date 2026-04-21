import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MobileLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

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
