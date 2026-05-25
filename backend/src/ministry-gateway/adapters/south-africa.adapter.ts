import axios from 'axios';
import { MinistryAdapter, MinistryConfig, VerificationRequest, VerificationResponse, InstitutionRegistrationRequest } from './ministry.adapter';
import * as crypto from 'crypto';

export class SouthAfricaAdapter extends MinistryAdapter {
  constructor(config: MinistryConfig) {
    super(config);
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  getCountryCode(): string {
    return 'ZA';
  }

  getAdapterName(): string {
    return 'South Africa Department of Basic Education';
  }

  async performAuthentication(): Promise<string> {
    const timestamp = Date.now().toString();
    const requestId = crypto.randomUUID();
    const signature = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(`${this.config.clientId}${timestamp}${requestId}`)
      .digest('hex');

    const response = await this.httpClient.post('/auth/v1/token', {
      client_id: this.config.clientId,
      request_id: requestId,
      timestamp,
      signature,
      scope: 'verification:read verification:write',
    });

    return (response.data as any).token;
  }

  buildVerificationPayload(request: VerificationRequest): Record<string, any> {
    return {
      request_type: 'DOCUMENT_VERIFICATION',
      document: {
        type: request.documentType,
        reference: request.documentId,
        certificate_number: request.certificateNumber,
        issue_date: request.issueDate,
      },
      student: {
        full_name: request.studentName,
        identifier: request.studentId,
      },
      institution: {
        identifier: request.institutionId,
      },
      country_code: 'ZA',
      additional_data: request.metadata,
    };
  }

  parseVerificationResponse(response: any): VerificationResponse {
    return {
      success: response.status === 'SUCCESS',
      verified: response.verification_result?.is_authentic === true,
      ministryReference: response.reference_number || '',
      status: response.status === 'SUCCESS'
        ? (response.verification_result?.is_authentic ? 'verified' : 'rejected')
        : 'error',
      data: response.verification_result,
      error: response.error_details?.message,
      timestamp: response.processed_at || new Date().toISOString(),
    };
  }

  async sendVerificationRequest(token: string, payload: Record<string, any>): Promise<any> {
    const response = await this.httpClient.post('/api/v1/verification/documents', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Source': 'SmartTech-SaaS',
      },
    });
    return response.data;
  }

  buildInstitutionRegistrationPayload(request: InstitutionRegistrationRequest): Record<string, any> {
    return {
      institution: {
        identifier: request.institutionId,
        name: request.name,
        registration_number: request.registrationNumber,
        type: request.type,
        country: 'ZA',
        contact: {
          email: request.contactEmail,
          phone: request.contactPhone,
        },
        metadata: request.metadata,
      },
    };
  }

  async sendInstitutionRegistration(token: string, payload: Record<string, any>): Promise<any> {
    const response = await this.httpClient.post('/api/v1/institutions', payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Source': 'SmartTech-SaaS',
      },
    });
    return response.data;
  }

  async sendStatusCheck(token: string, ministryReference: string): Promise<any> {
    const response = await this.httpClient.get(`/api/v1/verification/status/${ministryReference}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Source': 'SmartTech-SaaS',
      },
    });
    return response.data;
  }
}
