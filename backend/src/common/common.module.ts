import { Module, Global } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { CacheService } from './services/cache.service';
import { StudentFilterService } from './services/student-filter.service';
import { SchoolEventsGateway } from './school-events.gateway';

@Global()
@Module({
  providers: [ImageService, CacheService, StudentFilterService, SchoolEventsGateway],
  exports: [ImageService, CacheService, StudentFilterService, SchoolEventsGateway],
})
export class CommonModule {}
