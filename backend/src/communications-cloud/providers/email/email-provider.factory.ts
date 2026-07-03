import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { ZohoAdapter, type ZohoConfig } from './adapters/zoho.adapter';
import { SendGridAdapter, type SendGridConfig } from './adapters/sendgrid.adapter';
import { AmazonSESAdapter, type AmazonSESConfig } from './adapters/amazon-ses.adapter';
import { MailgunAdapter, type MailgunConfig } from './adapters/mailgun.adapter';
import { SmtpAdapter, type SmtpConfig } from './adapters/smtp.adapter';
import type { EmailProvider } from '../../interfaces/provider.interface';

@Injectable()
export class EmailProviderFactory {
  private readonly logger = new Logger(EmailProviderFactory.name);
  private readonly providerCache = new Map<string, EmailProvider>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async getProvider(providerId: string): Promise<EmailProvider> {
    if (this.providerCache.has(providerId)) {
      return this.providerCache.get(providerId)!;
    }

    const provider = await this.prisma.commCloudProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Email provider ${providerId} not found`);
    }

    if (provider.channel !== 'EMAIL') {
      throw new NotFoundException(`Provider ${providerId} is not an email provider`);
    }

    const adapter = this.buildAdapter(provider.providerType, provider.credentials as Record<string, any> | null);
    this.providerCache.set(providerId, adapter);
    return adapter;
  }

  async getAllProviders(): Promise<EmailProvider[]> {
    const providers = await this.prisma.commCloudProvider.findMany({
      where: { channel: 'EMAIL', isActive: true },
      orderBy: { priority: 'asc' },
    });

    return providers.map((p) => {
      const adapter = this.buildAdapter(p.providerType, p.credentials as Record<string, any> | null);
      this.providerCache.set(p.id, adapter);
      return adapter;
    });
  }

  async getProviderByType(type: string): Promise<EmailProvider | null> {
    for (const [id, adapter] of this.providerCache.entries()) {
      if (id.startsWith(type)) {
        return adapter;
      }
    }

    const provider = await this.prisma.commCloudProvider.findFirst({
      where: { channel: 'EMAIL', providerType: type, isActive: true },
      orderBy: { priority: 'asc' },
    });

    if (!provider) {
      return null;
    }

    const adapter = this.buildAdapter(provider.providerType, provider.credentials as Record<string, any> | null);
    this.providerCache.set(provider.id, adapter);
    return adapter;
  }

  clearCache(): void {
    this.providerCache.clear();
  }

  private buildAdapter(providerType: string, credentials: Record<string, any> | null): EmailProvider {
    if (!credentials) {
      throw new Error(`No credentials configured for email provider type: ${providerType}`);
    }

    const decrypted = this.decryptCredentials(credentials);

    switch (providerType) {
      case 'zoho':
        return new ZohoAdapter(decrypted as ZohoConfig);
      case 'sendgrid':
        return new SendGridAdapter({
          apiKey: decrypted.apiKey,
          fromEmail: decrypted.fromEmail,
          fromName: decrypted.fromName,
        } as SendGridConfig);
      case 'amazon-ses':
      case 'ses':
        return new AmazonSESAdapter({
          region: decrypted.region,
          accessKeyId: decrypted.accessKeyId || decrypted.accessKey,
          secretAccessKey: decrypted.secretAccessKey || decrypted.secretKey,
          fromEmail: decrypted.fromEmail,
        } as AmazonSESConfig);
      case 'mailgun':
        return new MailgunAdapter({
          apiKey: decrypted.apiKey,
          domain: decrypted.domain,
          fromEmail: decrypted.fromEmail,
          fromName: decrypted.fromName,
        } as MailgunConfig);
      case 'smtp':
      case 'generic-smtp':
        return new SmtpAdapter({
          host: decrypted.host,
          port: decrypted.port || 587,
          secure: decrypted.secure ?? false,
          user: decrypted.user || decrypted.username,
          pass: decrypted.pass || decrypted.password,
          fromEmail: decrypted.fromEmail,
          fromName: decrypted.fromName || decrypted.name,
        } as SmtpConfig);
      default:
        throw new Error(`Unknown email provider type: ${providerType}`);
    }
  }

  private decryptCredentials(credentials: Record<string, any>): Record<string, any> {
    const decrypted: Record<string, any> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string' && value.includes(':') && value.length > 40) {
        try {
          decrypted[key] = this.encryptionService.decrypt(value);
        } catch {
          decrypted[key] = value;
        }
      } else {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }
}
