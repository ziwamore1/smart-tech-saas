import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import type { PushProvider } from '../../interfaces/provider.interface';
import { FirebaseAdapter } from './adapters/firebase.adapter';
import { ExpoAdapter } from './adapters/expo.adapter';

@Injectable()
export class PushProviderFactory {
  private readonly logger = new Logger(PushProviderFactory.name);
  private readonly adapterCache = new Map<string, PushProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async createProvider(providerId?: string): Promise<PushProvider> {
    if (providerId && this.adapterCache.has(providerId)) {
      return this.adapterCache.get(providerId)!;
    }

    const where: any = {
      channel: 'PUSH',
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
      throw new Error(`No active Push provider found${providerId ? ` with id: ${providerId}` : ''}`);
    }

    const adapter = this.buildAdapter(provider);

    if (providerId) {
      this.adapterCache.set(providerId, adapter);
    }

    return adapter;
  }

  async createAllProviders(): Promise<Map<string, PushProvider>> {
    const providers = await this.prisma.commCloudProvider.findMany({
      where: { channel: 'PUSH', isActive: true },
      orderBy: [{ priority: 'asc' }, { weight: 'desc' }],
    });

    const map = new Map<string, PushProvider>();
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

  private buildAdapter(provider: any): PushProvider {
    switch (provider.providerType) {
      case 'firebase':
      case 'fcm': {
        const creds = this.decryptCredentials(provider.credentials as Record<string, string> | null);
        return new FirebaseAdapter({
          projectId: creds.projectId || provider.projectId,
          clientEmail: creds.clientEmail,
          privateKey: creds.privateKey,
          serviceAccountPath: creds.serviceAccountPath,
        });
      }

      case 'expo': {
        const creds = this.decryptCredentials(provider.credentials as Record<string, string> | null);
        return new ExpoAdapter({
          accessToken: creds.accessToken,
        });
      }

      default:
        throw new Error(`Unsupported Push provider type: ${provider.providerType}`);
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
