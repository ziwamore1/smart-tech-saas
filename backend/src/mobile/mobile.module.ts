import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AppInfoController } from './app-info.controller';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { StaffPositionModule } from '../staff-position/staff-position.module';
import { StudentModule } from '../student/student.module';
import { AdmissionNumberModule } from '../admission-number/admission-number.module';

@Module({
  imports: [IntelligenceModule, StaffPositionModule, StudentModule, AdmissionNumberModule],
  controllers: [MobileController, AppInfoController],
  providers: [MobileService],
})
export class MobileModule {}
