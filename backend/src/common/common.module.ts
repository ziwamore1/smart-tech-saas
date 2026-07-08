import { Module, Global } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { CacheService } from './services/cache.service';
import { StudentFilterService } from './services/student-filter.service';

@Global()
@Module({
  providers: [ImageService, CacheService, StudentFilterService],
  exports: [ImageService, CacheService, StudentFilterService],
})
export class CommonModule {}
