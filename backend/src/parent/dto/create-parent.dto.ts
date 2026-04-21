import { IsEmail, IsOptional, IsString, MinLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class StudentLinkDto {
  @IsString()
  studentId: string;
}

export class CreateParentDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentLinkDto)
  children?: StudentLinkDto[];
}
