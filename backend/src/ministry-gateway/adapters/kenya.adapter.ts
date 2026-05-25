import axios from 'axios';
import { MinistryAdapter, MinistryConfig, VerificationRequest, VerificationResponse, InstitutionRegistrationRequest } from './ministry.adapter';
import * as crypto from 'crypto';

export class KenyaAdapter extends MinistryAdapter {
  constructor(config: MinistryConfig) {
    super(config);
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  getCountryCode(): string {
    return 'KE';
  }

  getAdapterName(): string {
    return 'Kenya Ministry of Education';
  }

  async performAuthentication(): Promise<string> {
    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    const signature = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(`${this.config.clientId}${timestamp}${nonce}`)
      .digest('hex');

    const response = await this.httpClient.post('/oauth2/token', {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      timestamp,
      nonce,
      signature,
    });

    return (response.data as any).access_token;
  }

  buildVerificationPayload(request: VerificationRequest): Record<string, any> {
    return {
      verification_type: 'academic_document',
      document_type: request.documentType,
      document_reference: request.documentId,
      student: {
        name: request.studentName,
        id: request.studentId,
      },
      institution: {
        id: request.institutionId,
      },
      certificate: {
        number: request.certificateNumber,
        issue_date: request.issueDate,
      },
      country: 'KE',
      metadata: request.metadata,
    };
  }

  parseVerificationResponse(response: any): VerificationResponse {
    return {
      success: response.success === true,
      verified: response.result?.verified === true,
      ministryReference: response.result?.reference || '',
      status: response.success ? (response.result?.verified ? 'verified' : 'rejected') : 'error',
      data: response.result,
      error: response.error?.message,
      timestamp: response.timestamp || new Date().toISOString(),
    };
  }

  async sendVerificationRequest(token: string, payload: Record<string, any>): Promise<any> {
    const response = await this.httpClient.post('/api/v2/verification/academic', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-API-Version': '2.0',
      },
    });
    return response.data;
  }

  buildInstitutionRegistrationPayload(request: InstitutionRegistrationRequest): Record<string, any> {
    return {
      institution_id: request.institutionId,
      name: request.name,
      registration_number: request.registrationNumber,
      institution_type: request.type,
      country: 'KE',
      contact: {
        email: request.contactEmail,
        phone: request.contactPhone,
      },
      metadata: request.metadata,
    };
  }

  async sendInstitutionRegistration(token: string, payload: Record<string, any>): Promise<any> {
    const response = await this.httpClient.post('/api/v2/institutions', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-API-Version': '2.0',
      },
    });
    return response.data;
  }

  async sendStatusCheck(token: string, ministryReference: string): Promise<any> {
    const response = await this.httpClient.get(`/api/v2/verification/status/${ministryReference}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-API-Version': '2.0',
      },
    });
    return response.data;
  }
}
