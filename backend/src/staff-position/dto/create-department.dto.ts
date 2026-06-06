import { IsString, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  name: string;

  @IsOptional() @IsString() code?: string;

  @IsString()
  category: string;

  @IsOptional() @IsString() description?: string;
}
