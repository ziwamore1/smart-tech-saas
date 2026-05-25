import axios from 'axios';
import { MinistryAdapter, MinistryConfig, VerificationRequest, VerificationResponse, InstitutionRegistrationRequest } from './ministry.adapter';
import * as crypto from 'crypto';

export class ZambiaAdapter extends MinistryAdapter {
  constructor(config: MinistryConfig) {
    super(config);
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  getCountryCode(): string {
    return 'ZM';
  }

  getAdapterName(): string {
    return 'Zambia Ministry of Education';
  }

  async performAuthentication(): Promise<string> {
    const timestamp = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(`${this.config.clientId}${timestamp}`)
      .digest('hex');

    const response = await this.httpClient.post('/api/v1/auth/token', {
      client_id: this.config.clientId,
      timestamp,
      signature,
    });

    return (response.data as any).access_token;
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
      country: 'ZM',
      metadata: request.metadata,
    };
  }

  parseVerificationResponse(response: any): VerificationResponse {
    return {
      success: response.status === 'success',
      verified: response.verified === true,
      ministryReference: response.reference || '',
      status: response.status === 'success' ? (response.verified ? 'verified' : 'rejected') : 'error',
      data: response.data,
      error: response.error,
      timestamp: response.timestamp || new Date().toISOString(),
    };
  }

  async sendVerificationRequest(token: string, payload: Record<string, any>): Promise<any> {
    const response = await this.httpClient.post('/api/v1/verify/document', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  buildInstitutionRegistrationPayload(request: InstitutionRegistrationRequest): Record<string, any> {
    return {
      institution_id: request.institutionId,
      name: request.name,
      registration_number: request.registrationNumber,
      type: request.type,
      country: 'ZM',
      contact_email: request.contactEmail,
      contact_phone: request.contactPhone,
      metadata: request.metadata,
    };
  }

  async sendInstitutionRegistration(token: string, payload: Record<string, any>): Promise<any> {
    const response = await this.httpClient.post('/api/v1/institutions/register', payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async sendStatusCheck(token: string, ministryReference: string): Promise<any> {
    const response = await this.httpClient.get(`/api/v1/verify/status/${ministryReference}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
}
