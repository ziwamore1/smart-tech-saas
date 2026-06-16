import { IsString, IsOptional, IsArray, IsDateString, IsEnum, IsObject, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class LessonPlanSectionDto {
  @IsString()
  id: string;

  @IsString()
  type: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class LessonPlanConfigDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultSectionTypes?: string[];

  @IsOptional()
  customSections?: boolean;

  @IsOptional()
  allowReordering?: boolean;

  @IsOptional()
  showSectionTitles?: boolean;
}

export class CreateLessonPlanDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  classId: string;

  @IsString()
  subjectId: string;

  @IsDateString()
  weekStart: string;

  @IsDateString()
  weekEnd: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsString()
  procedures?: string;

  @IsOptional()
  @IsString()
  assessment?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonPlanSectionDto)
  content?: LessonPlanSectionDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LessonPlanConfigDto)
  config?: LessonPlanConfigDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  attachments?: any[];

  @IsOptional()
  @IsString()
  status?: string;
}
