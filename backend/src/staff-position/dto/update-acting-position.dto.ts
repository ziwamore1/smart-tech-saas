import { IsOptional, IsString, IsBoolean, IsDateString, IsIn } from 'class-validator';

export class UpdateActingPositionDto {
  @IsOptional() @IsString() positionType?: string;
  @IsOptional() @IsIn(['PRIMARY', 'SECONDARY']) section?: 'PRIMARY' | 'SECONDARY';
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
