import axios from 'axios';
import { MinistryAdapter, MinistryConfig, VerificationRequest, VerificationResponse, InstitutionRegistrationRequest } from './ministry.adapter';
import * as crypto from 'crypto';

export interface CustomAdapterConfig extends MinistryConfig {
  authEndpoint?: string;
  verifyEndpoint?: string;
  registerEndpoint?: string;
  statusEndpoint?: string;
  authMethod?: 'hmac' | 'oauth2' | 'api_key';
  apiKey?: string;
  customHeaders?: Record<string, string>;
}

export class CustomInstitutionAdapter extends MinistryAdapter {
  private customConfig: CustomAdapterConfig;

  constructor(config: CustomAdapterConfig) {
    super(config);
    this.customConfig = config;
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.customHeaders,
      },
    });
  }

  getCountryCode(): string {
    return this.customConfig.country || 'CUSTOM';
  }

  getAdapterName(): string {
    return `Custom Institution (${this.customConfig.country})`;
  }

  async performAuthentication(): Promise<string> {
    const method = this.customConfig.authMethod || 'hmac';

    switch (method) {
      case 'api_key':
        return this.customConfig.apiKey || '';

      case 'oauth2':
        return this.oauth2Auth();

      case 'hmac':
      default:
        return this.hmacAuth();
    }
  }

  private async oauth2Auth(): Promise<string> {
    const endpoint = this.customConfig.authEndpoint || '/oauth2/token';
    const response = await this.httpClient.post(endpoint, {
      grant_type: 'client_credentials',
      client_id: this.customConfig.clientId,
      client_secret: this.customConfig.clientSecret,
    });
    return (response.data as any).access_token;
  }

  private async hmacAuth(): Promise<string> {
    const endpoint = this.customConfig.authEndpoint || '/auth/token';
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', this.customConfig.clientSecret)
      .update(`${this.customConfig.clientId}${timestamp}`)
      .digest('hex');

    const response = await this.httpClient.post(endpoint, {
      client_id: this.customConfig.clientId,
      timestamp,
      signature,
    });
    const data = response.data as any;
    return data.access_token || data.token;
  }

  buildVerificationPayload(request: VerificationRequest): Record<string, any> {
    return {
      document_type: request.documentType,
      document_id: request.documentId,
      student_name: request.studentName,
      student_id: request.studentId,
      institution_id: request.institutionId,
      certificate_number: request.certificateNumber,
      issue_date: request.issueDate,
      country: this.customConfig.country,
      metadata: request.metadata,
    };
  }

  parseVerificationResponse(response: any): VerificationResponse {
    return {
      success: response.success === true || response.status === 'success',
      verified: response.verified === true || response.is_authentic === true,
      ministryReference: response.reference || response.reference_number || response.id || '',
      status: this.determineStatus(response),
      data: response.data || response.result || response,
      error: response.error || response.error_message,
      timestamp: response.timestamp || response.created_at || new Date().toISOString(),
    };
  }

  private determineStatus(response: any): 'verified' | 'pending' | 'rejected' | 'error' {
    if (response.verified === true || response.is_authentic === true) return 'verified';
    if (response.status === 'pending') return 'pending';
    if (response.status === 'rejected' || response.verified === false) return 'rejected';
    if (response.error) return 'error';
    return 'pending';
  }

  async sendVerificationRequest(token: string, payload: Record<string, any>): Promise<any> {
    const endpoint = this.customConfig.verifyEndpoint || '/api/v1/verify';
    const response = await this.httpClient.post(endpoint, payload, {
      headers: this.buildAuthHeaders(token),
    });
    return response.data;
  }

  buildInstitutionRegistrationPayload(request: InstitutionRegistrationRequest): Record<string, any> {
    return {
      institution_id: request.institutionId,
      name: request.name,
      registration_number: request.registrationNumber,
      type: request.type,
      country: this.customConfig.country,
      contact_email: request.contactEmail,
      contact_phone: request.contactPhone,
      metadata: request.metadata,
    };
  }

  async sendInstitutionRegistration(token: string, payload: Record<string, any>): Promise<any> {
    const endpoint = this.customConfig.registerEndpoint || '/api/v1/institutions';
    const response = await this.httpClient.post(endpoint, payload, {
      headers: this.buildAuthHeaders(token),
    });
    return response.data;
  }

  async sendStatusCheck(token: string, ministryReference: string): Promise<any> {
    const endpoint = this.customConfig.statusEndpoint || `/api/v1/verify/status/${ministryReference}`;
    const response = await this.httpClient.get(endpoint, {
      headers: this.buildAuthHeaders(token),
    });
    return response.data;
  }

  private buildAuthHeaders(token: string): Record<string, string> {
    const method = this.customConfig.authMethod || 'hmac';
    const headers: Record<string, string> = {};

    if (method === 'api_key') {
      headers['X-API-Key'] = token;
    } else {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return { ...headers, ...this.customConfig.customHeaders };
  }
}
