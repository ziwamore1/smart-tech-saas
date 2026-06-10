import { plainToInstance } from 'class-transformer';
import { IsString, IsOptional, validateSync } from 'class-validator';

export class CloudinaryEnvironmentVariables {
  @IsString()
  CLOUDINARY_CLOUD_NAME!: string;

  @IsString()
  CLOUDINARY_API_KEY!: string;

  @IsString()
  CLOUDINARY_API_SECRET!: string;

  @IsOptional()
  @IsString()
  CLOUDINARY_FOLDER?: string;
}

export function validateCloudinaryConfig(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(CloudinaryEnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: process.env.NODE_ENV !== 'production' });

  if (errors.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Cloudinary configuration validation failed: ${errors
          .map(e => Object.values(e.constraints || {}).join(', '))
          .join('; ')}`,
      );
    }
    console.warn('Cloudinary not fully configured. Uploads will use local fallback in development.');
  }

  return validatedConfig;
}
