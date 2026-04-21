import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface FlutterwavePaymentRequest {
  amount: number;
  currency: string;
  email: string;
  phone?: string;
  fullname: string;
  description?: string;
  redirectUrl: string;
  meta?: Record<string, any>;
}

export interface FlutterwavePaymentResponse {
  status: string;
  message: string;
  data: {
    link: string;
    flw_ref: string;
    order_ref: string;
  };
}

export interface FlutterwaveWebhookData {
  event: string;
  'data.id': number;
  'data.tx_ref': string;
  'data.flw_ref': string;
  'data.amount': number;
  'data.currency': string;
  'data.status': string;
  'data.customer.email': string;
  'data.customer.phone_number'?: string;
}

export interface MobileMoneyRequest {
  amount: number;
  currency: string;
  email: string;
  phone: string;
  network: string; // MTN, AIRTEL, ZAMTEL
  fullname: string;
  description?: string;
  redirectUrl: string;
}

export interface MobileMoneyResponse {
  status: string;
  message: string;
  data: {
    link: string;
    flw_ref: string;
    order_ref: string;
    meta: {
      authorization: {
        mode: string;
        redirect: string;
      };
    };
  };
}

@Injectable()
export class FlutterwaveService {
  private readonly api: ReturnType<typeof axios.create>;
  private readonly secretKey: string;
  private readonly publicKey: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.get<string>('FLUTTERWAVE_SECRET_KEY') || '';
    this.publicKey = this.config.get<string>('FLUTTERWAVE_PUBLIC_KEY') || '';

    this.api = axios.create({
      baseURL: 'https://api.flutterwave.com/v3',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
    };
  }

  async createPaymentLink(
    request: FlutterwavePaymentRequest,
  ): Promise<FlutterwavePaymentResponse> {
    try {
      const payload = {
        amount: request.amount,
        currency: request.currency,
        customer: {
          email: request.email,
          phone_number: request.phone,
          name: request.fullname,
        },
        customizations: {
          title: 'Smart Tech School SaaS',
          description:
            request.description || 'School Management System Subscription',
          logo: 'https://your-logo-url.com/logo.png',
        },
        redirect_url: request.redirectUrl,
        tx_ref: `TX-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        meta: request.meta,
      };

      const response = await this.api.post('/payments', payload, {
        headers: this.getAuthHeaders(),
      });

      return response.data as FlutterwavePaymentResponse;
    } catch (error: any) {
      console.error(
        'Flutterwave payment link creation failed:',
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to create payment link',
      );
    }
  }

  async createMobileMoneyPayment(
    request: MobileMoneyRequest,
  ): Promise<MobileMoneyResponse> {
    try {
      const payload = {
        amount: request.amount,
        currency: request.currency,
        customer: {
          email: request.email,
          phone_number: request.phone,
          name: request.fullname,
        },
        customizations: {
          title: 'Smart Tech School SaaS',
          description:
            request.description || 'School Management System Subscription',
        },
        redirect_url: request.redirectUrl,
        tx_ref: `TX-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        payment_options: 'mobilemoney',
        mobile_money: {
          phone_number: request.phone,
          provider: request.network.toUpperCase(),
        },
        meta: {
          consumer_id: request.phone,
          consumer_mac: '92a3-912ba-1192a',
        },
      };

      const response = await this.api.post('/payments', payload, {
        headers: this.getAuthHeaders(),
      });

      return response.data as MobileMoneyResponse;
    } catch (error: any) {
      console.error(
        'Flutterwave mobile money payment failed:',
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        error.response?.data?.message ||
          'Failed to initiate mobile money payment',
      );
    }
  }

  async verifyTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.api.get(
        `/transactions/${transactionId}/verify`,
        {
          headers: this.getAuthHeaders(),
        },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        'Transaction verification failed:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to verify transaction');
    }
  }

  async createSubscription(
    email: string,
    amount: number,
    currency: string,
  ): Promise<any> {
    try {
      const payload = {
        email,
        amount,
        currency,
        duration: 30,
        frequency: 30,
        name: 'School SaaS Subscription',
      };

      const response = await this.api.post('/billing-subscription', payload, {
        headers: this.getAuthHeaders(),
      });

      return response.data;
    } catch (error: any) {
      console.error(
        'Subscription creation failed:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to create subscription');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<any> {
    try {
      const response = await this.api.delete(
        `/billing-subscription/${subscriptionId}`,
        {
          headers: this.getAuthHeaders(),
        },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        'Subscription cancellation failed:',
        error.response?.data || error.message,
      );
      throw new BadRequestException('Failed to cancel subscription');
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const hash = require('crypto')
      .createHash('sha256')
      .update(payload + this.secretKey)
      .digest('hex');
    return hash === signature;
  }

  parseWebhookEvent(payload: any): FlutterwaveWebhookData {
    return payload as FlutterwaveWebhookData;
  }

  getPublicKey(): string {
    return this.publicKey;
  }
}
