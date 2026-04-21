import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './payment.controller';
import { FlutterwaveService } from './flutterwave.service';
import { ReceiptService } from './receipt.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, FlutterwaveService, ReceiptService],
  exports: [SubscriptionService, FlutterwaveService, ReceiptService],
})
export class PaymentModule {}
