import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { PushProvider } from '../../../interfaces/provider.interface';
import type { SendPushOptions, SendResult } from '../../../interfaces/message.interface';

export interface FirebaseConfig {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  serviceAccountPath?: string;
}

export class FirebaseAdapter implements PushProvider {
  private readonly logger = new Logger(FirebaseAdapter.name);
  private readonly providerName = 'firebase';
  private initialized = false;

  constructor(config: FirebaseConfig) {
    this.initializeApp(config);
  }

  private initializeApp(config: FirebaseConfig): void {
    try {
      if (admin.apps.length > 0) {
        this.initialized = true;
        return;
      }

      if (config.serviceAccountPath) {
        const serviceAccount = require(config.serviceAccountPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: config.projectId || serviceAccount.project_id,
        });
      } else if (config.projectId && config.clientEmail && config.privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: config.projectId,
            clientEmail: config.clientEmail,
            privateKey: config.privateKey.replace(/\\n/g, '\n'),
          }),
        });
      } else {
        admin.initializeApp({
          projectId: config.projectId,
        });
      }

      this.initialized = true;
      this.logger.log('Firebase app initialized successfully');
    } catch (error) {
      this.logger.error(`Firebase initialization failed: ${error.message}`);
    }
  }

  async send(options: SendPushOptions): Promise<SendResult> {
    try {
      this.logger.log(`Sending push via Firebase to ${Array.isArray(options.to) ? options.to.length : 1} recipient(s)`);

      const message: admin.messaging.Message = {
        notification: {
          title: options.title,
          body: options.body,
        },
        android: {
          notification: {
            channelId: options.channelId,
            icon: options.icon,
            sound: options.sound,
            clickAction: options.clickAction,
          },
          priority: options.priority === 'HIGH' || options.priority === 'CRITICAL' ? 'high' : 'normal',
        },
        apns: {
          payload: {
            aps: {
              alert: { title: options.title, body: options.body },
              badge: options.badge as any,
              sound: options.sound || 'default',
              'content-available': options.silent ? 1 : undefined,
            },
          },
        },
        data: options.data as Record<string, string> | undefined,
      };

      if (options.silent) {
        delete message.notification;
      }

      if (Array.isArray(options.to) && options.to.length > 1) {
        const multicast: admin.messaging.MulticastMessage = {
          tokens: options.to,
          notification: message.notification,
          android: message.android,
          apns: message.apns,
          data: message.data,
        };
        const response = await admin.messaging().sendEachForMulticast(multicast);
        return {
          success: response.failureCount === 0,
          provider: this.providerName,
          messageId: options.metadata?.id as string || '',
          providerMessageId: response.responses.find((r) => r.success)?.messageId,
          status: response.failureCount === 0 ? 'SENT' : 'FAILED',
          creditsUsed: response.successCount,
          rawResponse: {
            successCount: response.successCount,
            failureCount: response.failureCount,
          },
        };
      }

      const target = Array.isArray(options.to) ? options.to[0] : options.to;
      if (target.startsWith('/topics/')) {
        message.topic = target.replace('/topics/', '');
      } else if (target.includes('&&') || target.includes('||')) {
        message.condition = target;
      } else {
        message.token = target;
      }

      const response = await admin.messaging().send(message);

      return {
        success: true,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        providerMessageId: response,
        status: 'SENT',
        rawResponse: { messageId: response },
      };
    } catch (error) {
      this.logger.error(`Firebase send failed: ${error.message}`);
      return {
        success: false,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const start = Date.now();
    try {
      if (!this.initialized) {
        return { status: 'unhealthy', latencyMs: Date.now() - start, details: 'Firebase app not initialized' };
      }
      const app = admin.app();
      const projectId = app.options.projectId || 'unknown';
      const latencyMs = Date.now() - start;
      return { status: 'healthy', latencyMs, details: `Project: ${projectId}, Apps: ${admin.apps.length}` };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return { status: 'unhealthy', latencyMs, details: error.message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    return { balance: 0, currency: 'N/A' };
  }
}
