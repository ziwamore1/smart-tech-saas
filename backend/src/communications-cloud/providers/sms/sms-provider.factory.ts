import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { BeemService } from '../../../beem/beem.service';
import { TwilioService } from '../../../twilio/twilio.service';
import { SmsProvider } from '../../interfaces/provider.interface';
import { BeemAdapter } from './adapters/beem.adapter';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { AfricasTalkingAdapter } from './adapters/africastalking.adapter';
import { InfobipAdapter } from './adapters/infobip.adapter';
import { ZamtelAdapter } from './adapters/zamtel.adapter';
import { MtnAdapter } from './adapters/mtn.adapter';
import { AirtelAdapter } from './adapters/airtel.adapter';

type AdapterConstructor = new (...args: any[]) => SmsProvider;

@Injectable()
export class SmsProviderFactory {
  private readonly logger = new Logger(SmsProviderFactory.name);
  private readonly registry = new Map<string, AdapterConstructor>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
    private readonly beemService: BeemService,
    private readonly twilioService: TwilioService,
  ) {
    this.registry.set('beem', BeemAdapter);
    this.registry.set('twilio', TwilioAdapter);
    this.registry.set('africastalking', AfricasTalkingAdapter);
    this.registry.set('infobip', InfobipAdapter);
    this.registry.set('zamtel', ZamtelAdapter);
    this.registry.set('mtn', MtnAdapter);
    this.registry.set('airtel', AirtelAdapter);
  }

  async getProvider(providerId: string): Promise<SmsProvider> {
    const record = await this.prisma.commCloudProvider.findUnique({
      where: { id: providerId },
    });

    if (!record) {
      throw new Error(`CommCloudProvider with id "${providerId}" not found`);
    }

    if (!record.isActive) {
      throw new Error(`CommCloudProvider "${record.name}" is inactive`);
    }

    return this.buildAdapter(record);
  }

  async getAllProviders(): Promise<SmsProvider[]> {
    const records = await this.prisma.commCloudProvider.findMany({
      where: { channel: 'SMS', isActive: true },
      orderBy: { priority: 'asc' },
    });

    return Promise.all(records.map((r) => this.buildAdapter(r)));
  }

  getProviderByType(type: string): SmsProvider | null {
    const normalized = type.toLowerCase().trim();
    const Ctor = this.registry.get(normalized);

    if (!Ctor) {
      this.logger.warn(`No adapter registered for provider type "${type}"`);
      return null;
    }

    if (normalized === 'beem') {
      return new Ctor(this.beemService) as SmsProvider;
    }

    if (normalized === 'twilio') {
      return new Ctor(this.twilioService) as SmsProvider;
    }

    const apiKey = this.configService.get<string>(`${normalized.toUpperCase()}_API_KEY`);
    const username = this.configService.get<string>(`${normalized.toUpperCase()}_USERNAME`);
    const baseUrl = this.configService.get<string>(`${normalized.toUpperCase()}_BASE_URL`);
    const from = this.configService.get<string>(`${normalized.toUpperCase()}_FROM`);

    if (!apiKey) {
      this.logger.warn(`No API key configured for provider type "${type}" via env`);
      return null;
    }

    return new Ctor({ apiKey, username, baseUrl, from }) as SmsProvider;
  }

  private buildAdapter(record: {
    id: string;
    providerType: string;
    credentials?: Record<string, any> | null;
    config?: Record<string, any> | null;
  }): SmsProvider {
    const type = record.providerType.toLowerCase().trim();
    const Ctor = this.registry.get(type);

    if (!Ctor) {
      throw new Error(`Unsupported SMS provider type: "${record.providerType}"`);
    }

    if (type === 'beem') {
      return new Ctor(this.beemService) as SmsProvider;
    }

    if (type === 'twilio') {
      return new Ctor(this.twilioService) as SmsProvider;
    }

    const rawCredentials = this.resolveCredentials(record);
    return new Ctor(rawCredentials) as SmsProvider;
  }

  private resolveCredentials(record: {
    credentials?: Record<string, any> | null;
    config?: Record<string, any> | null;
  }): Record<string, any> {
    const creds: Record<string, any> = { ...(record.credentials || {}), ...(record.config || {}) };

    for (const [key, value] of Object.entries(creds)) {
      if (typeof value === 'string' && value.startsWith('enc:')) {
        try {
          creds[key] = this.encryptionService.decrypt(value.slice(4));
        } catch (err) {
          this.logger.warn(`Failed to decrypt credential "${key}": ${err.message}`);
        }
      }
    }

    return creds;
  }
}
