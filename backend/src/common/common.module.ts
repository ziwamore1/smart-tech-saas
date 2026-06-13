import { Module, Global } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { CacheService } from './services/cache.service';

@Global()
@Module({
  providers: [ImageService, CacheService],
  exports: [ImageService, CacheService],
})
export class CommonModule {}
