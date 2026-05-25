export interface VerificationRequestDto {
  documentType: string;
  documentId: string;
  studentName?: string;
  studentId?: string;
  institutionId?: string;
  certificateNumber?: string;
  issueDate?: string;
  countryCode?: string;
  metadata?: Record<string, any>;
}

export interface InstitutionRegistrationDto {
  institutionId: string;
  name: string;
  registrationNumber: string;
  type: string;
  countryCode: string;
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, any>;
}

export interface StatusCheckDto {
  ministryReference: string;
  countryCode?: string;
}

export function validateVerificationRequest(data: any): VerificationRequestDto {
  const errors: string[] = [];

  if (!data.documentType || typeof data.documentType !== 'string') {
    errors.push('documentType is required and must be a string');
  }

  if (!data.documentId || typeof data.documentId !== 'string') {
    errors.push('documentId is required and must be a string');
  }

  if (data.studentName && typeof data.studentName !== 'string') {
    errors.push('studentName must be a string');
  }

  if (data.studentId && typeof data.studentId !== 'string') {
    errors.push('studentId must be a string');
  }

  if (data.institutionId && typeof data.institutionId !== 'string') {
    errors.push('institutionId must be a string');
  }

  if (data.certificateNumber && typeof data.certificateNumber !== 'string') {
    errors.push('certificateNumber must be a string');
  }

  if (data.issueDate) {
    const date = new Date(data.issueDate);
    if (isNaN(date.getTime())) {
      errors.push('issueDate must be a valid date');
    }
  }

  if (data.countryCode && typeof data.countryCode !== 'string') {
    errors.push('countryCode must be a string');
  }

  if (data.metadata && typeof data.metadata !== 'object') {
    errors.push('metadata must be an object');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return {
    documentType: data.documentType,
    documentId: data.documentId,
    studentName: data.studentName,
    studentId: data.studentId,
    institutionId: data.institutionId,
    certificateNumber: data.certificateNumber,
    issueDate: data.issueDate,
    countryCode: data.countryCode,
    metadata: data.metadata,
  };
}

export function validateInstitutionRegistration(data: any): InstitutionRegistrationDto {
  const errors: string[] = [];

  if (!data.institutionId || typeof data.institutionId !== 'string') {
    errors.push('institutionId is required and must be a string');
  }

  if (!data.name || typeof data.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!data.registrationNumber || typeof data.registrationNumber !== 'string') {
    errors.push('registrationNumber is required and must be a string');
  }

  if (!data.type || typeof data.type !== 'string') {
    errors.push('type is required and must be a string');
  }

  if (!data.countryCode || typeof data.countryCode !== 'string') {
    errors.push('countryCode is required and must be a string');
  }

  if (data.contactEmail && typeof data.contactEmail !== 'string') {
    errors.push('contactEmail must be a string');
  }

  if (data.contactPhone && typeof data.contactPhone !== 'string') {
    errors.push('contactPhone must be a string');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return {
    institutionId: data.institutionId,
    name: data.name,
    registrationNumber: data.registrationNumber,
    type: data.type,
    countryCode: data.countryCode,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    metadata: data.metadata,
  };
}

export function validateStatusCheck(data: any): StatusCheckDto {
  const errors: string[] = [];

  if (!data.ministryReference || typeof data.ministryReference !== 'string') {
    errors.push('ministryReference is required and must be a string');
  }

  if (data.countryCode && typeof data.countryCode !== 'string') {
    errors.push('countryCode must be a string');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return {
    ministryReference: data.ministryReference,
    countryCode: data.countryCode,
  };
}
