import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

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
}
