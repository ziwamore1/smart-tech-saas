import { Module, Global } from '@nestjs/common';
import { LaafficService } from './laaffic.service';
import { LaafficWebhookController } from './laaffic-webhook.controller';

@Global()
@Module({
  controllers: [LaafficWebhookController],
  providers: [LaafficService],
  exports: [LaafficService],
})
export class LaafficModule {}
