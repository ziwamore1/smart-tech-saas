import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash } from 'crypto';

@Injectable()
export class StampsService {
  private readonly logger = new Logger(StampsService.name);

  constructor(private prisma: PrismaService) {}

  async getStamps(schoolId: string) {
    const stamps = await this.prisma.digitalStamp.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    });
    return { stamps };
  }

  async getStampedDocuments(schoolId: string, userId: string, roles: string[]) {
    const isDirector = roles.includes('Director') || roles.includes('Head Teacher');
    const isClassTeacher = roles.includes('Class Teacher');

    const where: any = { schoolId };

    if (isClassTeacher && !isDirector) {
      where.OR = [
        { appliedById: userId },
        { status: 'approved' },
      ];
    }

    const documents = await this.prisma.documentStamp.findMany({
      where,
      include: {
        stamp: { select: { id: true, name: true, type: true } },
        appliedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });

    return {
      documents: documents.map(d => ({
        id: d.id,
        documentId: d.documentId,
        documentType: d.documentType,
        stampId: d.stampId,
        stampName: d.stamp.name,
        stampType: d.stamp.type,
        appliedBy: d.appliedById,
        appliedByName: `${d.appliedBy.firstName} ${d.appliedBy.lastName}`,
        appliedAt: d.appliedAt,
        verificationHash: d.verificationHash,
        status: d.status,
      })),
    };
  }

  async getApprovalRequests(schoolId: string) {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { schoolId },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });

    return {
      requests: requests.map(r => ({
        id: r.id,
        documentId: r.documentId,
        documentName: r.documentName,
        documentType: r.documentType,
        requestedBy: r.requestedById,
        requestedByName: `${r.requestedBy.firstName} ${r.requestedBy.lastName}`,
        requestedAt: r.requestedAt,
        status: r.status,
        approverId: r.approverId,
        approverName: r.approver ? `${r.approver.firstName} ${r.approver.lastName}` : null,
        approvedAt: r.approvedAt,
      })),
    };
  }

  async applyStamp(schoolId: string, userId: string, roles: string[], data: { documentId: string; stampId: string; note?: string }) {
    if (!roles.includes('Director') && !roles.includes('Head Teacher') && !roles.includes('Admin')) {
      throw new ForbiddenException('Only Directors and Admins can apply official stamps');
    }

    const stamp = await this.prisma.digitalStamp.findFirst({
      where: { id: data.stampId, schoolId },
    });
    if (!stamp) {
      throw new NotFoundException('Stamp not found');
    }

    const verificationHash = createHash('sha256')
      .update(`${data.documentId}-${stamp.id}-${userId}-${Date.now()}`)
      .digest('hex');

    const docStamp = await this.prisma.documentStamp.create({
      data: {
        documentId: data.documentId,
        documentType: data.note || 'document',
        stampId: data.stampId,
        appliedById: userId,
        schoolId,
        verificationHash,
        status: 'approved',
      },
    });

    await this.prisma.approvalAuditLog.create({
      data: {
        documentId: data.documentId,
        action: 'STAMP_APPLIED',
        userId,
        stampId: data.stampId,
        note: data.note,
        schoolId,
      },
    });

    return {
      id: docStamp.id,
      verificationHash: docStamp.verificationHash,
      message: 'Stamp applied successfully',
    };
  }

  async approveDocument(schoolId: string, userId: string, requestId: string, data: { approved: boolean; note?: string }) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, schoolId },
    });
    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: {
        status: data.approved ? 'approved' : 'rejected',
        approverId: userId,
        approvedAt: new Date(),
        note: data.note,
      },
    });

    await this.prisma.approvalAuditLog.create({
      data: {
        documentId: request.documentId,
        action: data.approved ? 'APPROVAL_GRANTED' : 'APPROVAL_DENIED',
        userId,
        note: data.note,
        schoolId,
      },
    });

    return { success: true, status: updated.status };
  }

  async requestApproval(schoolId: string, userId: string, data: { documentId: string; note?: string }) {
    const request = await this.prisma.approvalRequest.create({
      data: {
        documentId: data.documentId,
        documentName: data.note || 'Document',
        documentType: 'report',
        requestedById: userId,
        schoolId,
        status: 'pending',
      },
    });

    return { id: request.id, status: request.status };
  }

  async verifyDocument(hash: string) {
    const stamp = await this.prisma.documentStamp.findFirst({
      where: { verificationHash: hash },
      include: {
        stamp: { select: { name: true, type: true } },
        appliedBy: { select: { firstName: true, lastName: true } },
        school: { select: { name: true } },
      },
    });

    if (!stamp) {
      return { valid: false, message: 'Document not found or invalid hash' };
    }

    const auditTrail = await this.prisma.approvalAuditLog.findMany({
      where: { documentId: stamp.documentId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      valid: true,
      documentId: stamp.documentId,
      documentType: stamp.documentType,
      stampName: stamp.stamp.name,
      stampType: stamp.stamp.type,
      appliedBy: `${stamp.appliedBy.firstName} ${stamp.appliedBy.lastName}`,
      appliedAt: stamp.appliedAt,
      schoolName: stamp.school?.name,
      auditTrail: auditTrail.map(a => ({
        action: a.action,
        user: a.user ? `${a.user.firstName} ${a.user.lastName}` : 'System',
        timestamp: a.createdAt,
      })),
    };
  }

  async getApprovalWorkflows(schoolId: string, userId: string, roles: string[]) {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: { schoolId },
      include: {
        steps: { orderBy: { order: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      workflows: workflows.map(w => ({
        id: w.id,
        documentId: w.documentId,
        documentName: w.documentName,
        documentType: w.documentType,
        status: w.status,
        createdAt: w.createdAt,
        createdBy: w.createdById,
        createdByName: `${w.createdBy.firstName} ${w.createdBy.lastName}`,
        currentStep: w.currentStep,
        steps: w.steps.map(s => ({
          id: s.id,
          role: s.role,
          userId: s.userId,
          userName: s.userName,
          status: s.status,
          completedAt: s.completedAt,
          note: s.note,
        })),
      })),
    };
  }

  async createApprovalWorkflow(schoolId: string, userId: string, data: { documentId: string; documentName: string; documentType: string }) {
    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        documentId: data.documentId,
        documentName: data.documentName,
        documentType: data.documentType,
        createdById: userId,
        schoolId,
        status: 'pending',
        steps: {
          create: [
            { role: 'Class Teacher', order: 0, status: 'approved', userId, userName: 'Auto-approved' },
            { role: 'Director', order: 1, status: 'pending' },
          ],
        },
      },
      include: { steps: true },
    });

    return { id: workflow.id, status: workflow.status };
  }

  async processApprovalStep(schoolId: string, userId: string, workflowId: string, stepId: string, data: { approved: boolean; note?: string }) {
    const step = await this.prisma.approvalStep.findFirst({
      where: { id: stepId, workflow: { schoolId } },
      include: { workflow: { include: { steps: true } } },
    });
    if (!step) {
      throw new NotFoundException('Step not found');
    }

    await this.prisma.approvalStep.update({
      where: { id: stepId },
      data: {
        status: data.approved ? 'approved' : 'rejected',
        completedAt: new Date(),
        note: data.note,
        userId,
      },
    });

    const newStatus = data.approved
      ? (step.order + 1 < step.workflow.steps.length ? 'in_progress' : 'completed')
      : 'rejected';

    await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: newStatus,
        currentStep: data.approved ? step.order + 1 : step.order,
      },
    });

    return { success: true, status: newStatus };
  }

  async uploadStamp(schoolId: string, userId: string, data: { name: string; type: string; svgContent?: string; imageUrl?: string }) {
    const stamp = await this.prisma.digitalStamp.create({
      data: {
        name: data.name,
        type: data.type as any,
        schoolId,
        svgContent: data.svgContent,
        imageUrl: data.imageUrl,
        createdBy: userId,
      },
    });

    return { id: stamp.id, name: stamp.name };
  }
}
