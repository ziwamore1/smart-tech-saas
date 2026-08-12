import { Module, Global } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { CacheService } from './services/cache.service';
import { StudentFilterService } from './services/student-filter.service';
import { OwnershipService } from './services/ownership.service';
import { SchoolEventsGateway } from './school-events.gateway';
import { ClassAccessService } from './access/class-access.service';
import { AccessController } from './access/access.controller';

@Global()
@Module({
  controllers: [AccessController],
  providers: [ImageService, CacheService, StudentFilterService, OwnershipService, SchoolEventsGateway, ClassAccessService],
  exports: [ImageService, CacheService, StudentFilterService, OwnershipService, SchoolEventsGateway, ClassAccessService],
})
export class CommonModule {}
