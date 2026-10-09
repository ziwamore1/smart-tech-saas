import { Module } from '@nestjs/common';
import { StudentAwardsController } from './student-awards.controller';
import { StudentAwardsService } from './student-awards.service';

@Module({ controllers: [StudentAwardsController], providers: [StudentAwardsService], exports: [StudentAwardsService] })
export class StudentAwardsModule {}
