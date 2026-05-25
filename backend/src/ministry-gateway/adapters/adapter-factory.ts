import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinistryAdapter, MinistryConfig, VerificationRequest, VerificationResponse, InstitutionRegistrationRequest } from './ministry.adapter';
import { ZambiaAdapter } from './zambia.adapter';
import { KenyaAdapter } from './kenya.adapter';
import { SouthAfricaAdapter } from './south-africa.adapter';
import { CustomInstitutionAdapter, CustomAdapterConfig } from './custom-institution.adapter';

export interface AdapterConfig {
  country: string;
  enabled: boolean;
  config: MinistryConfig | CustomAdapterConfig;
}

@Injectable()
export class MinistryAdapterFactory {
  private readonly logger = new Logger(MinistryAdapterFactory.name);
  private adapters: Map<string, MinistryAdapter> = new Map();
  private defaultAdapter: MinistryAdapter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    this.registerZambiaAdapter();
    this.registerKenyaAdapter();
    this.registerSouthAfricaAdapter();
    this.registerCustomAdapters();
  }

  private registerZambiaAdapter(): void {
    const enabled = this.configService.get<string>('MINISTRY_ZAMBIA_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log('Zambia ministry adapter disabled');
      return;
    }

    const config: MinistryConfig = {
      apiUrl: this.configService.get<string>('MINISTRY_ZAMBIA_API_URL') || '',
      clientId: this.configService.get<string>('MINISTRY_ZAMBIA_CLIENT_ID') || '',
      clientSecret: this.configService.get<string>('MINISTRY_ZAMBIA_CLIENT_SECRET') || '',
      jwtSecret: this.configService.get<string>('MINISTRY_ZAMBIA_JWT_SECRET') || '',
      timeout: parseInt(this.configService.get<string>('MINISTRY_ZAMBIA_TIMEOUT') || '30000'),
      country: 'ZM',
    };

    if (config.apiUrl && config.clientId) {
      const adapter = new ZambiaAdapter(config);
      this.adapters.set('ZM', adapter);
      this.logger.log('Zambia ministry adapter registered');

      if (!this.defaultAdapter) {
        this.defaultAdapter = adapter;
      }
    }
  }

  private registerKenyaAdapter(): void {
    const enabled = this.configService.get<string>('MINISTRY_KENYA_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log('Kenya ministry adapter disabled');
      return;
    }

    const config: MinistryConfig = {
      apiUrl: this.configService.get<string>('MINISTRY_KENYA_API_URL') || '',
      clientId: this.configService.get<string>('MINISTRY_KENYA_CLIENT_ID') || '',
      clientSecret: this.configService.get<string>('MINISTRY_KENYA_CLIENT_SECRET') || '',
      jwtSecret: this.configService.get<string>('MINISTRY_KENYA_JWT_SECRET') || '',
      timeout: parseInt(this.configService.get<string>('MINISTRY_KENYA_TIMEOUT') || '30000'),
      country: 'KE',
    };

    if (config.apiUrl && config.clientId) {
      const adapter = new KenyaAdapter(config);
      this.adapters.set('KE', adapter);
      this.logger.log('Kenya ministry adapter registered');
    }
  }

  private registerSouthAfricaAdapter(): void {
    const enabled = this.configService.get<string>('MINISTRY_SOUTH_AFRICA_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log('South Africa ministry adapter disabled');
      return;
    }

    const config: MinistryConfig = {
      apiUrl: this.configService.get<string>('MINISTRY_SOUTH_AFRICA_API_URL') || '',
      clientId: this.configService.get<string>('MINISTRY_SOUTH_AFRICA_CLIENT_ID') || '',
      clientSecret: this.configService.get<string>('MINISTRY_SOUTH_AFRICA_CLIENT_SECRET') || '',
      jwtSecret: this.configService.get<string>('MINISTRY_SOUTH_AFRICA_JWT_SECRET') || '',
      timeout: parseInt(this.configService.get<string>('MINISTRY_SOUTH_AFRICA_TIMEOUT') || '30000'),
      country: 'ZA',
    };

    if (config.apiUrl && config.clientId) {
      const adapter = new SouthAfricaAdapter(config);
      this.adapters.set('ZA', adapter);
      this.logger.log('South Africa ministry adapter registered');
    }
  }

  private registerCustomAdapters(): void {
    const customConfigs = this.configService.get<string>('MINISTRY_CUSTOM_ADAPTERS') || '';

    if (!customConfigs) return;

    try {
      const configs: AdapterConfig[] = JSON.parse(customConfigs);

      for (const custom of configs) {
        if (!custom.enabled) continue;

        const config = custom.config as CustomAdapterConfig;
        const adapter = new CustomInstitutionAdapter(config);
        this.adapters.set(config.country, adapter);
        this.logger.log(`Custom ministry adapter registered: ${config.country}`);
      }
    } catch (error) {
      this.logger.error(`Failed to parse custom adapters: ${error.message}`);
    }
  }

  getAdapter(countryCode: string): MinistryAdapter | null {
    return this.adapters.get(countryCode.toUpperCase()) || this.defaultAdapter;
  }

  getDefaultAdapter(): MinistryAdapter | null {
    return this.defaultAdapter;
  }

  getAllAdapters(): Map<string, MinistryAdapter> {
    return this.adapters;
  }

  getAvailableCountries(): string[] {
    return Array.from(this.adapters.keys());
  }

  async verifyDocument(request: VerificationRequest, countryCode?: string): Promise<VerificationResponse> {
    const adapter = countryCode ? this.getAdapter(countryCode) : this.getDefaultAdapter();

    if (!adapter) {
      return {
        success: false,
        verified: false,
        ministryReference: '',
        status: 'error',
        error: 'No ministry adapter available',
        timestamp: new Date().toISOString(),
      };
    }

    return adapter.verifyDocument(request);
  }

  async registerInstitution(request: InstitutionRegistrationRequest, countryCode?: string): Promise<any> {
    const adapter = countryCode ? this.getAdapter(countryCode) : this.getDefaultAdapter();

    if (!adapter) {
      throw new Error('No ministry adapter available');
    }

    return adapter.registerInstitution(request);
  }

  async checkStatus(ministryReference: string, countryCode?: string): Promise<any> {
    const adapter = countryCode ? this.getAdapter(countryCode) : this.getDefaultAdapter();

    if (!adapter) {
      throw new Error('No ministry adapter available');
    }

    return adapter.checkStatus(ministryReference);
  }

  isAdapterAvailable(countryCode: string): boolean {
    const adapter = this.getAdapter(countryCode);
    return adapter ? adapter.isAvailable() : false;
  }
}
