import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { BeemService } from '../../../beem/beem.service';
import type { WhatsAppProvider } from '../../interfaces/provider.interface';
import { BeemWhatsAppAdapter } from './adapters/beem-whatsapp.adapter';
import { MetaBusinessAdapter } from './adapters/meta-business.adapter';
import { TwilioWhatsAppAdapter } from './adapters/twilio-whatsapp.adapter';

@Injectable()
export class WhatsAppProviderFactory {
  private readonly logger = new Logger(WhatsAppProviderFactory.name);
  private readonly adapterCache = new Map<string, WhatsAppProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly beemService: BeemService,
  ) {}

  async createProvider(providerId?: string): Promise<WhatsAppProvider> {
    if (providerId && this.adapterCache.has(providerId)) {
      return this.adapterCache.get(providerId)!;
    }

    const where: any = {
      channel: 'WHATSAPP',
      isActive: true,
    };
    if (providerId) {
      where.id = providerId;
    }

    const provider = await this.prisma.commCloudProvider.findFirst({
      where,
      orderBy: [{ priority: 'asc' }, { weight: 'desc' }],
    });

    if (!provider) {
      throw new Error(`No active WhatsApp provider found${providerId ? ` with id: ${providerId}` : ''}`);
    }

    const adapter = this.buildAdapter(provider);

    if (providerId) {
      this.adapterCache.set(providerId, adapter);
    }

    return adapter;
  }

  async createAllProviders(): Promise<Map<string, WhatsAppProvider>> {
    const providers = await this.prisma.commCloudProvider.findMany({
      where: { channel: 'WHATSAPP', isActive: true },
      orderBy: [{ priority: 'asc' }, { weight: 'desc' }],
    });

    const map = new Map<string, WhatsAppProvider>();
    for (const p of providers) {
      try {
        const adapter = this.buildAdapter(p);
        map.set(p.id, adapter);
        this.adapterCache.set(p.id, adapter);
      } catch (error) {
        this.logger.error(`Failed to build adapter for provider ${p.name} (${p.id}): ${error.message}`);
      }
    }
    return map;
  }

  private buildAdapter(provider: any): WhatsAppProvider {
    switch (provider.providerType) {
      case 'beem': {
        return new BeemWhatsAppAdapter(this.beemService);
      }

      case 'meta':
      case 'meta-business':
      case 'facebook': {
        const creds = this.decryptCredentials(provider.credentials as Record<string, string> | null);
        return new MetaBusinessAdapter({
          accessToken: creds.accessToken || '',
          phoneNumberId: creds.phoneNumberId || '',
          businessAccountId: creds.businessAccountId || provider.businessAccountId,
          apiVersion: creds.apiVersion || 'v22.0',
        });
      }

      case 'twilio': {
        const creds = this.decryptCredentials(provider.credentials as Record<string, string> | null);
        return new TwilioWhatsAppAdapter({
          accountSid: creds.accountSid || creds.apiKey || '',
          authToken: creds.authToken || creds.apiSecret || '',
          from: creds.from || provider.from || 'whatsapp:+14155238886',
        });
      }

      default:
        throw new Error(`Unsupported WhatsApp provider type: ${provider.providerType}`);
    }
  }

  private decryptCredentials(credentials: Record<string, string> | null): Record<string, string> {
    if (!credentials) return {};
    const decrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      try {
        decrypted[key] = this.encryptionService.decrypt(value);
      } catch {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }

  clearCache(): void {
    this.adapterCache.clear();
  }
}
