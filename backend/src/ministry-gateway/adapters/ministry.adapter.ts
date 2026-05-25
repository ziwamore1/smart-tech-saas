import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export type HttpClient = ReturnType<typeof axios.create>;

export interface MinistryConfig {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  jwtSecret: string;
  timeout: number;
  country: string;
}

export interface VerificationRequest {
  documentType: string;
  documentId: string;
  studentName?: string;
  studentId?: string;
  institutionId?: string;
  certificateNumber?: string;
  issueDate?: string;
  metadata?: Record<string, any>;
}

export interface VerificationResponse {
  success: boolean;
  verified: boolean;
  ministryReference: string;
  status: 'verified' | 'pending' | 'rejected' | 'error';
  data?: Record<string, any>;
  error?: string;
  timestamp: string;
}

export interface InstitutionRegistrationRequest {
  institutionId: string;
  name: string;
  registrationNumber: string;
  type: string;
  country: string;
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, any>;
}

export abstract class MinistryAdapter {
  protected readonly logger = new Logger(this.constructor.name);
  protected config: MinistryConfig;
  protected httpClient: HttpClient;
  protected accessToken: string | null = null;
  protected tokenExpiresAt: Date | null = null;

  constructor(config: MinistryConfig) {
    this.config = config;
  }

  abstract getCountryCode(): string;
  abstract getAdapterName(): string;
  abstract buildVerificationPayload(request: VerificationRequest): Record<string, any>;
  abstract parseVerificationResponse(response: any): VerificationResponse;
  abstract buildInstitutionRegistrationPayload(request: InstitutionRegistrationRequest): Record<string, any>;

  async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    this.logger.log(`Authenticating with ${this.getAdapterName()} ministry API`);

    try {
      const token = await this.performAuthentication();
      this.accessToken = token;
      this.tokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000);
      return token;
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new Error(`Ministry authentication failed: ${error.message}`);
    }
  }

  protected abstract performAuthentication(): Promise<string>;

  async verifyDocument(request: VerificationRequest): Promise<VerificationResponse> {
    this.logger.log(`Verifying document via ${this.getAdapterName()}: ${request.documentId}`);

    try {
      const token = await this.authenticate();
      const payload = this.buildVerificationPayload(request);
      const response = await this.sendVerificationRequest(token, payload);
      return this.parseVerificationResponse(response);
    } catch (error) {
      this.logger.error(`Document verification failed: ${error.message}`);
      return {
        success: false,
        verified: false,
        ministryReference: '',
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  protected abstract sendVerificationRequest(token: string, payload: Record<string, any>): Promise<any>;

  async registerInstitution(request: InstitutionRegistrationRequest): Promise<any> {
    this.logger.log(`Registering institution via ${this.getAdapterName()}: ${request.institutionId}`);

    try {
      const token = await this.authenticate();
      const payload = this.buildInstitutionRegistrationPayload(request);
      return await this.sendInstitutionRegistration(token, payload);
    } catch (error) {
      this.logger.error(`Institution registration failed: ${error.message}`);
      throw new Error(`Institution registration failed: ${error.message}`);
    }
  }

  protected abstract sendInstitutionRegistration(token: string, payload: Record<string, any>): Promise<any>;

  async checkStatus(ministryReference: string): Promise<any> {
    this.logger.log(`Checking status via ${this.getAdapterName()}: ${ministryReference}`);

    try {
      const token = await this.authenticate();
      return await this.sendStatusCheck(token, ministryReference);
    } catch (error) {
      this.logger.error(`Status check failed: ${error.message}`);
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  protected abstract sendStatusCheck(token: string, ministryReference: string): Promise<any>;

  isAvailable(): boolean {
    return !!(this.config.apiUrl && this.config.clientId);
  }
}
