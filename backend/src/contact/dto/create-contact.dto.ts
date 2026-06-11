import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}
