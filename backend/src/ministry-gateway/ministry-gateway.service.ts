import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MinistryAdapterFactory } from './adapters/adapter-factory';
import {
  validateVerificationRequest,
  validateInstitutionRegistration,
  validateStatusCheck,
} from './validators/ministry.validators';
import * as crypto from 'crypto';

@Injectable()
export class MinistryGatewayService {
  private readonly logger = new Logger(MinistryGatewayService.name);

  constructor(
    private prisma: PrismaService,
    private adapterFactory: MinistryAdapterFactory,
  ) {}

  async submitForVerification(input: any): Promise<any> {
    this.logger.log(`Submitting document for ministry verification: ${input.documentId}`);

    const validated = validateVerificationRequest(input);
    const ministryReference = `MIN-${validated.countryCode || 'GLOBAL'}-${Date.now()}-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

    const verificationRecord = await this.prisma.ministryVerification.create({
      data: {
        documentId: validated.documentId,
        documentType: validated.documentType,
        schoolId: input.schoolId || '',
        ministryReference,
        ministryApiEndpoint: this.adapterFactory.getAdapter(validated.countryCode)?.getAdapterName(),
        verificationStatus: 'pending',
        verificationData: {
          studentName: validated.studentName,
          studentId: validated.studentId,
          institutionId: validated.institutionId,
          certificateNumber: validated.certificateNumber,
          issueDate: validated.issueDate,
          countryCode: validated.countryCode,
          ...validated.metadata,
        },
      },
    });

    const adapter = validated.countryCode
      ? this.adapterFactory.getAdapter(validated.countryCode)
      : this.adapterFactory.getDefaultAdapter();

    if (!adapter || !adapter.isAvailable()) {
      this.logger.warn('No ministry adapter available. Recording verification locally.');
      return {
        ministryReference,
        verificationStatus: 'pending',
        verifiedAt: null,
        ministryData: {
          message: 'Ministry API not configured. Verification pending.',
          adapter: adapter?.getAdapterName() || 'None',
        },
      };
    }

    try {
      const result = await adapter.verifyDocument({
        documentType: validated.documentType,
        documentId: validated.documentId,
        studentName: validated.studentName,
        studentId: validated.studentId,
        institutionId: validated.institutionId,
        certificateNumber: validated.certificateNumber,
        issueDate: validated.issueDate,
        metadata: validated.metadata,
      });

      await this.prisma.ministryVerification.update({
        where: { id: verificationRecord.id },
        data: {
          verificationStatus: result.status,
          verifiedAt: result.status === 'verified' ? new Date() : null,
          verificationData: {
            ...(verificationRecord.verificationData as object || {}),
            ministryResponse: JSON.parse(JSON.stringify(result)),
          },
        },
      });

      return {
        ministryReference: result.ministryReference || ministryReference,
        verificationStatus: result.status,
        verifiedAt: result.status === 'verified' ? new Date() : null,
        ministryData: result.data,
        adapter: adapter.getAdapterName(),
      };
    } catch (error) {
      this.logger.error(`Ministry API call failed: ${error.message}`);

      await this.prisma.ministryVerification.update({
        where: { id: verificationRecord.id },
        data: {
          verificationStatus: 'error',
          verificationData: {
            ...verificationRecord.verificationData as object,
            error: error.message,
          },
        },
      });

      return {
        ministryReference,
        verificationStatus: 'error',
        verifiedAt: null,
        ministryData: { error: error.message },
      };
    }
  }

  async checkVerificationStatus(input: any): Promise<any> {
    const validated = validateStatusCheck(input);

    const record = await this.prisma.ministryVerification.findUnique({
      where: { ministryReference: validated.ministryReference },
    });

    if (!record) {
      return null;
    }

    const adapter = validated.countryCode
      ? this.adapterFactory.getAdapter(validated.countryCode)
      : this.adapterFactory.getDefaultAdapter();

    if (!adapter || !adapter.isAvailable()) {
      return record;
    }

    try {
      const statusResult = await adapter.checkStatus(validated.ministryReference);

      const updatedStatus = statusResult?.status || record.verificationStatus;

      await this.prisma.ministryVerification.update({
        where: { id: record.id },
        data: {
          verificationStatus: updatedStatus,
          verifiedAt: updatedStatus === 'verified' ? new Date() : record.verifiedAt,
          verificationData: {
            ...record.verificationData as object,
            latestCheck: statusResult,
            checkedAt: new Date().toISOString(),
          },
        },
      });

      return {
        ...record,
        verificationStatus: updatedStatus,
        latestMinistryData: statusResult,
      };
    } catch (error) {
      this.logger.error(`Failed to check ministry status: ${error.message}`);
      return record;
    }
  }

  async registerInstitution(input: any): Promise<any> {
    const validated = validateInstitutionRegistration(input);

    const adapter = validated.countryCode
      ? this.adapterFactory.getAdapter(validated.countryCode)
      : this.adapterFactory.getDefaultAdapter();

    if (!adapter || !adapter.isAvailable()) {
      return {
        success: false,
        message: 'No ministry adapter available for this country',
      };
    }

    try {
      const result = await adapter.registerInstitution({
        institutionId: validated.institutionId,
        name: validated.name,
        registrationNumber: validated.registrationNumber,
        type: validated.type,
        country: validated.countryCode,
        contactEmail: validated.contactEmail,
        contactPhone: validated.contactPhone,
        metadata: validated.metadata,
      });

      return {
        success: true,
        data: result,
        adapter: adapter.getAdapterName(),
      };
    } catch (error) {
      this.logger.error(`Institution registration failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getDocumentMinistryVerification(documentId: string): Promise<any> {
    return this.prisma.ministryVerification.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSchoolVerifications(schoolId: string, status?: string): Promise<any[]> {
    return this.prisma.ministryVerification.findMany({
      where: {
        schoolId,
        ...(status ? { verificationStatus: status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getAvailableCountries(): string[] {
    return this.adapterFactory.getAvailableCountries();
  }

  getAdapterStatus(): Record<string, boolean> {
    const adapters = this.adapterFactory.getAllAdapters();
    const status: Record<string, boolean> = {};

    for (const [country, adapter] of adapters) {
      status[country] = adapter.isAvailable();
    }

    return status;
  }
}
