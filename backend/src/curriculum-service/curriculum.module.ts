import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CurriculumService } from './curriculum.service';
import { CurriculumController } from './curriculum.controller';
import { Grade7EngineService } from './grade7-engine.service';
import { SelectionAnalyticsService } from './selection-analytics.service';

@Module({
  imports: [PrismaModule],
  controllers: [CurriculumController],
  providers: [CurriculumService, Grade7EngineService, SelectionAnalyticsService],
  exports: [CurriculumService, Grade7EngineService, SelectionAnalyticsService],
})
export class CurriculumModule {}
