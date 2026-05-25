import { Module, Global } from '@nestjs/common';
import { BeemService } from './beem.service';
import { BeemWebhookController } from './beem-webhook.controller';

@Global()
@Module({
  controllers: [BeemWebhookController],
  providers: [BeemService],
  exports: [BeemService],
})
export class BeemModule {}
