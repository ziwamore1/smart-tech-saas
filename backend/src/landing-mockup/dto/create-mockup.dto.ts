import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class CreateMockupDto {
  @IsString()
  label: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  imageUrl: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
