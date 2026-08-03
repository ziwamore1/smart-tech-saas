import { Module, Global } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { CacheService } from './services/cache.service';
import { StudentFilterService } from './services/student-filter.service';
import { OwnershipService } from './services/ownership.service';
import { SchoolEventsGateway } from './school-events.gateway';

@Global()
@Module({
  providers: [ImageService, CacheService, StudentFilterService, OwnershipService, SchoolEventsGateway],
  exports: [ImageService, CacheService, StudentFilterService, OwnershipService, SchoolEventsGateway],
})
export class CommonModule {}
