import { Module, Global } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { TwilioWebhookController } from './twilio-webhook.controller';

@Global()
@Module({
  controllers: [TwilioWebhookController],
  providers: [TwilioService],
  exports: [TwilioService],
})
export class TwilioModule {}
