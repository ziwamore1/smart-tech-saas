import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlutterwaveService } from './flutterwave.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

export interface CreateSubscriptionDto {
  schoolId: string;
  planId: string;
  paymentMethod: 'card' | 'mobilemoney';
  phone?: string;
  network?: 'MTN' | 'AIRTEL' | 'ZAMTEL';
}

export interface SubscriptionPlanDetails {
  id: string;
  name: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  maxStudents: number;
  maxTeachers: number;
  maxClasses: number;
  features: string[];
}

@Injectable()
export class SubscriptionService {
  constructor(
    private prisma: PrismaService,
    private flutterwave: FlutterwaveService,
    private config: ConfigService,
  ) {}

  async getPlans(): Promise<SubscriptionPlanDetails[]> {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPrice: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      maxStudents: plan.maxStudents,
      maxTeachers: plan.maxTeachers,
      maxClasses: plan.maxClasses,
      features: plan.features as string[],
    }));
  }

  async getPlanByName(name: string): Promise<any> {
    return this.prisma.subscriptionPlan.findUnique({
      where: { name: name.toUpperCase() },
    });
  }

  async getPlanById(planId: string): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return {
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      maxStudents: plan.maxStudents,
      maxTeachers: plan.maxTeachers,
      maxClasses: plan.maxClasses,
      maxStorageGB: plan.maxStorageGB,
      features: plan.features,
      isActive: plan.isActive,
      isPopular: plan.isPopular,
    };
  }

  async createPlan(data: {
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
  }): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: data.name.toUpperCase(),
        displayName: data.displayName,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        maxStudents: data.maxStudents,
        maxTeachers: data.maxTeachers,
        maxClasses: data.maxClasses,
        maxStorageGB: data.maxStorageGB,
        features: data.features as any,
        isActive: true,
        isPopular: false,
      },
    });

    return { data: plan, message: 'Plan created successfully' };
  }

  async updatePlan(planId: string, data: {
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
  }): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        displayName: data.displayName,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        maxStudents: data.maxStudents,
        maxTeachers: data.maxTeachers,
        maxClasses: data.maxClasses,
        maxStorageGB: data.maxStorageGB,
        features: data.features as any,
        isActive: data.isActive,
        isPopular: data.isPopular,
      },
    });

    return { data: updated, message: 'Plan updated successfully' };
  }

  async deletePlan(planId: string): Promise<any> {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    await this.prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    return { message: 'Plan deleted successfully' };
  }

  async getSchoolSubscription(schoolId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { schoolId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!subscription) {
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
      });

      return {
        status: school?.subscriptionStatus || 'trial',
        tier: school?.subscriptionTier || 'basic',
        trialEndsAt: school?.trialEndsAt,
        plan: null,
      };
    }

    return subscription;
  }

  async createPaymentIntent(dto: CreateSubscriptionDto) {
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
      include: { subscription: { include: { plan: true } } },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const director = await this.prisma.user.findFirst({
      where: {
        schoolId: dto.schoolId,
        userRoles: { some: { role: { name: 'Director' } } },
      },
    });

    if (!director) {
      throw new BadRequestException('No director found for this school');
    }

    const redirectUrl = `${this.config.get('FRONTEND_URL') || 'http://localhost:3000'}/subscription/payment-callback`;

    if (dto.paymentMethod === 'mobilemoney') {
      if (!dto.phone || !dto.network) {
        throw new BadRequestException(
          'Phone and network are required for mobile money payments',
        );
      }

      const response = await this.flutterwave.createMobileMoneyPayment({
        amount: plan.monthlyPrice,
        currency: plan.currency,
        email: director.email,
        phone: dto.phone || '',
        network: dto.network || 'MTN',
        fullname: `${director.firstName} ${director.lastName}`,
        description: `${plan.displayName} - Monthly Subscription`,
        redirectUrl,
      });

      const subscriptionId = school.subscription?.id;

      await this.prisma.payment.create({
        data: {
          subscriptionId: subscriptionId || '',
          amount: plan.monthlyPrice,
          currency: plan.currency,
          status: 'PENDING',
          paymentMethod: 'MOBILE_MONEY',
          mobileMoneyPhone: dto.phone || '',
          mobileMoneyNetwork: dto.network || 'MTN',
          description: `${plan.displayName} - Monthly Subscription`,
          metadata: {
            planId: dto.planId,
            schoolId: dto.schoolId,
            txRef: response.data.order_ref,
          },
        },
      });

      return {
        paymentLink: response.data.link,
        flwRef: response.data.flw_ref,
        orderRef: response.data.order_ref,
      };
    }

    const response = await this.flutterwave.createPaymentLink({
      amount: plan.monthlyPrice,
      currency: plan.currency,
      email: director.email,
      phone: director.phone || undefined,
      fullname: `${director.firstName} ${director.lastName}`,
      description: `${plan.displayName} - Monthly Subscription`,
      redirectUrl,
      meta: {
        planId: dto.planId,
        schoolId: dto.schoolId,
      },
    });

    const subscriptionId = school.subscription?.id;

    await this.prisma.payment.create({
      data: {
        subscriptionId: subscriptionId || '',
        amount: plan.monthlyPrice,
        currency: plan.currency,
        status: 'PENDING',
        paymentMethod: 'CARD',
        description: `${plan.displayName} - Monthly Subscription`,
        metadata: {
          planId: dto.planId,
          schoolId: dto.schoolId,
          txRef: response.data.order_ref,
        },
      },
    });

    return {
      paymentLink: response.data.link,
      flwRef: response.data.flw_ref,
      orderRef: response.data.order_ref,
    };
  }

  async handlePaymentCallback(transactionId: string, status: string) {
    const verification =
      await this.flutterwave.verifyTransaction(transactionId);

    if (verification.data.status !== 'successful') {
      throw new BadRequestException('Payment not successful');
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { flutterwavePaymentId: String(transactionId) },
          { metadata: { path: ['txRef'], equals: verification.data.tx_ref } },
        ],
      },
      include: { subscription: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        flutterwaveTransactionId: String(transactionId),
        flutterwavePaymentId: String(transactionId),
        paidAt: new Date(),
      },
    });

    const planId = (payment.metadata as any)?.planId;
    const schoolId = (payment.metadata as any)?.schoolId;

    if (planId && schoolId) {
      await this.activateSubscription(schoolId, planId);
    }

    return {
      success: true,
      message: 'Payment verified and subscription activated',
    };
  }

  async activateSubscription(schoolId: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.upsert({
        where: { schoolId },
        update: {
          planId: planId,
          status: 'ACTIVE',
          tier: plan.name as any,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
        create: {
          schoolId,
          planId: planId,
          status: 'ACTIVE',
          tier: plan.name as any,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      await tx.school.update({
        where: { id: schoolId },
        data: {
          subscriptionStatus: 'active',
          subscriptionTier: plan.name.toLowerCase(),
          subscriptionStartDate: now,
          subscriptionEndDate: periodEnd,
        },
      });

      return subscription;
    });

    return { success: true, message: 'Subscription activated' };
  }

  async cancelSubscription(schoolId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
        },
      });

      await tx.school.update({
        where: { id: schoolId },
        data: {
          subscriptionStatus: 'cancelled',
        },
      });
    });

    return {
      success: true,
      message:
        'Subscription will be cancelled at the end of the billing period',
    };
  }

  async changePlan(schoolId: string, newPlanId: string) {
    const newPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException('Plan not found');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { schoolId },
    });

    if (subscription?.flutterwaveSubscriptionId) {
      try {
        await this.flutterwave.cancelSubscription(
          subscription.flutterwaveSubscriptionId,
        );
      } catch (error) {
        console.error('Failed to cancel Flutterwave subscription:', error);
      }
    }

    return this.activateSubscription(schoolId, newPlanId);
  }

  async checkSubscriptionStatus(schoolId: string) {
    if (!schoolId) {
      return { status: 'active', tier: 'super', message: 'SuperAdmin account' };
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new NotFoundException('School not found');
    }

    if (school.subscriptionStatus === 'trial' && school.trialEndsAt) {
      const now = new Date();
      if (now > school.trialEndsAt) {
        await this.prisma.school.update({
          where: { id: schoolId },
          data: { subscriptionStatus: 'expired', isActive: false },
        });
        return { status: 'expired', message: 'Trial period has expired' };
      }
      const daysLeft = Math.ceil(
        (school.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return { status: 'trial', daysLeft, expiresAt: school.trialEndsAt };
    }

    if (school.subscriptionEndDate) {
      const now = new Date();
      if (now > school.subscriptionEndDate) {
        await this.prisma.school.update({
          where: { id: schoolId },
          data: { subscriptionStatus: 'expired', isActive: false },
        });
        await this.prisma.subscription.update({
          where: { schoolId },
          data: { status: 'EXPIRED' },
        });
        return { status: 'expired', message: 'Subscription has expired' };
      }
    }

    return {
      status: school.subscriptionStatus,
      tier: school.subscriptionTier,
      expiresAt: school.subscriptionEndDate,
    };
  }

  async seedDefaultPlans() {
    const defaultPlans = [
      {
        name: 'BASIC',
        displayName: 'Basic',
        description: 'Perfect for small schools getting started',
        monthlyPrice: 2900,
        yearlyPrice: 29000,
        maxStudents: 100,
        maxTeachers: 20,
        maxClasses: 10,
        maxStorageGB: 5,
        features: [
          'students.view',
          'students.add',
          'teachers.view',
          'teachers.add',
          'classes.view',
          'classes.add',
          'subjects.view',
          'subjects.add',
          'timetable.view',
          'timetable.edit',
          'results.view',
          'results.add',
          'results.bulkImport',
          'fees.view',
          'fees.manage',
          'communications.view',
          'communications.send',
          'analytics.view',
          'reports.generate',
          'reports.export',
          'advanced.backup',
          'advanced.restore',
        ],
        isActive: true,
        isPopular: false,
      },
      {
        name: 'STANDARD',
        displayName: 'Standard',
        description: 'For growing schools with more needs',
        monthlyPrice: 7900,
        yearlyPrice: 79000,
        maxStudents: 500,
        maxTeachers: 100,
        maxClasses: 30,
        maxStorageGB: 50,
        features: [
          'students.view',
          'students.add',
          'students.bulkImport',
          'students.advanced',
          'teachers.view',
          'teachers.add',
          'teachers.bulkImport',
          'classes.view',
          'classes.add',
          'subjects.view',
          'subjects.add',
          'timetable.view',
          'timetable.edit',
          'timetable.generate',
          'results.view',
          'results.add',
          'results.bulkImport',
          'results.reports',
          'fees.view',
          'fees.manage',
          'fees.onlinePayment',
          'communications.view',
          'communications.send',
          'communications.bulk',
          'analytics.view',
          'analytics.advanced',
          'reports.generate',
          'reports.custom',
          'reports.export',
          'integrations.api',
          'advanced.backup',
          'advanced.restore',
          'advanced.multiuser',
        ],
        isActive: true,
        isPopular: true,
      },
      {
        name: 'PREMIUM',
        displayName: 'Premium',
        description: 'Full-featured for large institutions',
        monthlyPrice: 14900,
        yearlyPrice: 149000,
        maxStudents: -1,
        maxTeachers: -1,
        maxClasses: -1,
        maxStorageGB: 500,
        features: [
          'students.view',
          'students.add',
          'students.bulkImport',
          'students.advanced',
          'teachers.view',
          'teachers.add',
          'teachers.bulkImport',
          'classes.view',
          'classes.add',
          'subjects.view',
          'subjects.add',
          'timetable.view',
          'timetable.edit',
          'timetable.generate',
          'timetable.constraints',
          'results.view',
          'results.add',
          'results.bulkImport',
          'results.reports',
          'fees.view',
          'fees.manage',
          'fees.onlinePayment',
          'communications.view',
          'communications.send',
          'communications.bulk',
          'communications.whatsapp',
          'analytics.view',
          'analytics.advanced',
          'analytics.ai',
          'reports.generate',
          'reports.custom',
          'reports.export',
          'integrations.api',
          'integrations.webhooks',
          'advanced.backup',
          'advanced.restore',
          'advanced.multiuser',
          'advanced.sso',
        ],
        isActive: true,
        isPopular: false,
      },
    ];

    for (const plan of defaultPlans) {
      await this.prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: {
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          maxStudents: plan.maxStudents,
          maxTeachers: plan.maxTeachers,
          maxClasses: plan.maxClasses,
          maxStorageGB: plan.maxStorageGB,
          features: plan.features as any,
        },
        create: plan,
      });
    }

    return { message: 'Default subscription plans created' };
  }
}
