import { Provider, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export const CLOUDINARY_TOKEN = 'CLOUDINARY';

export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY_TOKEN,
  useFactory: () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        );
      }
      const logger = new Logger('CloudinaryProvider');
      logger.warn('Cloudinary not configured — uploads will use local storage fallback.');
      return null;
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    return cloudinary;
  },
};
