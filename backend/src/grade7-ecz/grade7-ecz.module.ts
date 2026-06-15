import { Module } from '@nestjs/common';
import { Grade7EczController } from './grade7-ecz.controller';
import { Grade7EczService } from './grade7-ecz.service';
import { CurriculumModule } from '../curriculum-service/curriculum.module';

@Module({
  imports: [CurriculumModule],
  controllers: [Grade7EczController],
  providers: [Grade7EczService],
})
export class Grade7EczModule {}
