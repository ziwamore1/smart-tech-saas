import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { ReceiptService } from './receipt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly receiptService: ReceiptService,
  ) {}

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  @Get('my-subscription')
  getMySubscription(@Request() req) {
    return this.subscriptionService.getSchoolSubscription(req.user.schoolId);
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  checkStatus(@Request() req) {
    return this.subscriptionService.checkSubscriptionStatus(req.user.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  @Post('create-payment')
  createPayment(
    @Request() req,
    @Body()
    body: {
      planId: string;
      paymentMethod: 'card' | 'mobilemoney';
      phone?: string;
      network?: 'MTN' | 'AIRTEL' | 'ZAMTEL';
    },
  ) {
    return this.subscriptionService.createPaymentIntent({
      schoolId: req.user.schoolId,
      planId: body.planId,
      paymentMethod: body.paymentMethod,
      phone: body.phone,
      network: body.network,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  @Post('cancel')
  cancelSubscription(@Request() req) {
    return this.subscriptionService.cancelSubscription(req.user.schoolId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  @Post('change-plan')
  changePlan(@Request() req, @Body() body: { planId: string }) {
    return this.subscriptionService.changePlan(req.user.schoolId, body.planId);
  }

  @Get('receipts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  getReceipts(@Request() req) {
    return this.receiptService.getSchoolReceipts(req.user.schoolId);
  }

  @Get('receipt/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  getReceipt(@Param('id') id: string) {
    return this.receiptService.getReceiptById(id);
  }

  @Get('receipt/number/:receiptNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Director')
  getReceiptByNumber(@Param('receiptNumber') receiptNumber: string) {
    return this.receiptService.getReceiptByNumber(receiptNumber);
  }

  @Post('webhook/payment-callback')
  handlePaymentCallback(
    @Body()
    body: {
      transactionId: string;
      status: string;
    },
  ) {
    return this.subscriptionService.handlePaymentCallback(
      body.transactionId,
      body.status,
    );
  }

  @Get('plans/:id')
  getPlanById(@Param('id') id: string) {
    return this.subscriptionService.getPlanById(id);
  }
}

@Controller('subscription/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class SubscriptionPlansController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  getAllPlans() {
    return this.subscriptionService.getPlans();
  }

  @Post()
  createPlan(
    @Body()
    body: {
      name: string;
      displayName: string;
      description?: string;
      monthlyPrice: number;
      yearlyPrice: number;
      maxStudents: number;
      maxTeachers: number;
      maxClasses: number;
      maxStorageGB: number;
      features: string[];
    },
  ) {
    return this.subscriptionService.createPlan(body);
  }

  @Patch(':id')
  updatePlan(
    @Param('id') id: string,
    @Body()
    body: {
      displayName?: string;
      description?: string;
      monthlyPrice?: number;
      yearlyPrice?: number;
      maxStudents?: number;
      maxTeachers?: number;
      maxClasses?: number;
      maxStorageGB?: number;
      features?: string[];
      isActive?: boolean;
      isPopular?: boolean;
    },
  ) {
    return this.subscriptionService.updatePlan(id, body);
  }

  @Delete(':id')
  deletePlan(@Param('id') id: string) {
    return this.subscriptionService.deletePlan(id);
  }

  @Post('seed')
  seedPlans() {
    return this.subscriptionService.seedDefaultPlans();
  }
}
