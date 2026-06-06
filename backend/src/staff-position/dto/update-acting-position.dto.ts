import { IsOptional, IsString, IsBoolean, IsDateString } from 'class-validator';

export class UpdateActingPositionDto {
  @IsOptional() @IsString() positionType?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
