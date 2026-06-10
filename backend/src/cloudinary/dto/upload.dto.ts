import { IsString, IsOptional, IsEnum, IsNumber, Max } from 'class-validator';

export enum UploadResourceType {
  IMAGE = 'image',
  VIDEO = 'video',
  RAW = 'raw',
  AUTO = 'auto',
}

export class UploadOptionsDto {
  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  publicId?: string;

  @IsOptional()
  @IsEnum(UploadResourceType)
  resourceType?: UploadResourceType;

  @IsOptional()
  @IsNumber()
  @Max(10485760)
  maxFileSize?: number;
}

export class BulkUploadDto {
  @IsOptional()
  @IsString()
  folder?: string;
}

export class DeleteMediaDto {
  @IsString()
  publicId: string;
}

export class MediaFilterDto {
  @IsOptional()
  @IsString()
  folder?: string;

  @IsOptional()
  @IsString()
  uploadedBy?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 20;
}
