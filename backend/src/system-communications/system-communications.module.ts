import { Module } from '@nestjs/common';
import { SystemCommunicationsController } from './system-communications.controller';
import { SystemCommunicationsService } from './system-communications.service';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [SystemCommunicationsController],
  providers: [SystemCommunicationsService],
  exports: [SystemCommunicationsService],
})
export class SystemCommunicationsModule {}
