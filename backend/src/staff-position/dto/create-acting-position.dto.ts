import { IsString, IsOptional, IsBoolean, IsDateString } from 'class-validator';

export class CreateActingPositionDto {
  @IsString()
  teacherId: string;

  @IsString()
  positionType: string;

  @IsOptional() @IsString() departmentId?: string;

  @IsOptional() @IsString() classId?: string;

  @IsOptional() @IsBoolean() isPrimary?: boolean;

  @IsOptional() @IsDateString() startDate?: string;

  @IsOptional() @IsDateString() endDate?: string;
}
