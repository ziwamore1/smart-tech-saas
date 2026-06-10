export interface DigitalStamp {
  id: string;
  schoolId: string;
  name: string;
  type: 'official' | 'approval' | 'verified' | 'draft' | 'confidential';
  shape?: string;
  imageUrl?: string;
  svgContent?: string;
  opacity?: number;
  width?: number;
  height?: number;
  isActive?: boolean;
  isDefault?: boolean;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentStamp {
  id: string;
  documentId: string;
  documentType: string;
  stampId: string;
  stampName: string;
  stampType: string;
  appliedBy: string;
  appliedByName: string;
  appliedAt: string;
  verificationHash: string;
  status: 'pending' | 'approved' | 'rejected';
  qrData?: string;
}

export interface ApprovalRequest {
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approverId?: string;
  approverName?: string;
  approvedAt?: string;
  note?: string;
}

export interface ApprovalStep {
  id: string;
  workflowId?: string;
  role: string;
  userId?: string;
  userName?: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  order: number;
  note?: string;
  completedAt?: string;
}

export interface ApprovalWorkflow {
  id: string;
  documentId: string;
  documentName: string;
  documentType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdByName: string;
  currentStep: number;
  steps: ApprovalStep[];
}

export interface ApprovalAuditLog {
  id: string;
  documentId: string;
  action: string;
  userId?: string;
  userName?: string;
  stampId?: string;
  note?: string;
  createdAt: string;
}

export interface VerificationResult {
  valid: boolean;
  documentId?: string;
  documentType?: string;
  documentName?: string;
  stampName?: string;
  stampType?: string;
  appliedBy?: string;
  appliedAt?: string;
  schoolName?: string;
  message?: string;
  auditTrail?: ApprovalAuditLog[];
}

export interface StampConfig {
  id: string;
  name: string;
  title?: string;
  schoolName?: string;
  type: 'official' | 'approval' | 'verified' | 'draft' | 'confidential';
  color?: string;
  size?: number;
  opacity?: number;
  imageUrl?: string;
  svgContent?: string;
}

export type StampType = 'official' | 'approval' | 'verified' | 'draft' | 'confidential';

export const STAMP_COLORS: Record<StampType, string> = {
  official: '#1E3A8A',
  approval: '#059669',
  verified: '#0891B2',
  draft: '#6B7280',
  confidential: '#DC2626',
};
