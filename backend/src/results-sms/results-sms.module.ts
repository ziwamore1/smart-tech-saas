import { Module } from '@nestjs/common';
import { ResultsSmsController } from './results-sms.controller';
import { ResultsSmsService } from './results-sms.service';
import { PrismaService } from '../prisma/prisma.service';
import { TwilioService } from '../twilio/twilio.service';
import { BeemService } from '../beem/beem.service';

@Module({
  controllers: [ResultsSmsController],
  providers: [ResultsSmsService, PrismaService, TwilioService, BeemService],
  exports: [ResultsSmsService],
})
export class ResultsSmsModule {}
