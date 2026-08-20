import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ImageService } from './services/image.service';
import { CacheService } from './services/cache.service';
import { StudentFilterService } from './services/student-filter.service';
import { OwnershipService } from './services/ownership.service';
import { SchoolEventsGateway } from './school-events.gateway';
import { SchoolActivityService } from './services/school-activity.service';
import { ClassAccessService } from './access/class-access.service';
import { AccessController } from './access/access.controller';
import { SchoolActivityController } from './school-activity.controller';

@Global()
@Module({
  controllers: [AccessController, SchoolActivityController],
  providers: [
    ImageService,
    CacheService,
    StudentFilterService,
    OwnershipService,
    SchoolEventsGateway,
    SchoolActivityService,
    ClassAccessService,
  ],
  exports: [
    ImageService,
    CacheService,
    StudentFilterService,
    OwnershipService,
    SchoolEventsGateway,
    SchoolActivityService,
    ClassAccessService,
  ],
})
export class CommonModule implements OnModuleInit {
  constructor(
    private readonly gateway: SchoolEventsGateway,
    private readonly activityService: SchoolActivityService,
  ) {}

  onModuleInit() {
    this.activityService.setGateway(this.gateway);
  }
}
