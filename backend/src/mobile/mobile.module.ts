import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { IntelligenceModule } from '../intelligence/intelligence.module';

@Module({
  imports: [IntelligenceModule],
  controllers: [MobileController],
  providers: [MobileService],
})
export class MobileModule {}
