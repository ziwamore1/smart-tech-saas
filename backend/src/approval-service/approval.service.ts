import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SocketGateway } from '../messaging/socket.gateway';

export interface CreateWorkflowInput {
  documentId: string;
  documentName: string;
  documentType: string;
  createdById: string;
  schoolId: string;
  steps: {
    role: string;
    userId?: string;
    userName?: string;
    order: number;
  }[];
}

export interface ApproveStepInput {
  stepId: string;
  userId: string;
  action: 'approved' | 'rejected';
  note?: string;
  signature?: string;
}

export interface AddCommentInput {
  stepId: string;
  userId: string;
  comment: string;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private prisma: PrismaService,
    private socketGateway: SocketGateway,
  ) {}

  async createWorkflow(input: CreateWorkflowInput) {
    this.logger.log(`Creating approval workflow for document: ${input.documentId}`);

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        documentId: input.documentId,
        documentName: input.documentName,
        documentType: input.documentType,
        createdById: input.createdById,
        schoolId: input.schoolId,
        status: 'pending',
        currentStep: 0,
        steps: {
          create: input.steps.map((step) => ({
            role: step.role,
            userId: step.userId,
            userName: step.userName,
            order: step.order,
            status: 'pending',
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    await this.prisma.approvalAuditLog.create({
      data: {
        documentId: input.documentId,
        action: 'workflow_created',
        userId: input.createdById,
        schoolId: input.schoolId,
        note: `Approval workflow created with ${input.steps.length} steps`,
      },
    });

    await this.socketGateway.sendWorkflowUpdate({
      workflowId: workflow.id,
      documentId: input.documentId,
      schoolId: input.schoolId,
      status: 'pending',
      message: 'New approval workflow created',
    });

    return workflow;
  }

  async approveStep(input: ApproveStepInput) {
    this.logger.log(`Processing approval for step: ${input.stepId}`);

    const step = await this.prisma.approvalStep.findUnique({
      where: { id: input.stepId },
      include: {
        workflow: true,
      },
    });

    if (!step) {
      throw new NotFoundException('Approval step not found');
    }

    if (step.status !== 'pending') {
      throw new BadRequestException('Step has already been processed');
    }

    if (step.userId && step.userId !== input.userId) {
      throw new BadRequestException('Unauthorized to approve this step');
    }

    const updatedStep = await this.prisma.approvalStep.update({
      where: { id: input.stepId },
      data: {
        status: input.action === 'approved' ? 'approved' : 'rejected',
        action: input.action,
        note: input.note,
        signature: input.signature,
        completedAt: new Date(),
      },
    });

    await this.prisma.approvalAuditLog.create({
      data: {
        documentId: step.workflow.documentId,
        action: `step_${input.action}`,
        userId: input.userId,
        schoolId: step.workflow.schoolId,
        note: input.note || `Step ${step.order} ${input.action}`,
      },
    });

    if (input.action === 'rejected') {
      await this.prisma.approvalWorkflow.update({
        where: { id: step.workflowId },
        data: {
          status: 'rejected',
          finalStatus: 'rejected',
          completedAt: new Date(),
        },
      });

      await this.socketGateway.sendWorkflowUpdate({
        workflowId: step.workflowId,
        documentId: step.workflow.documentId,
        schoolId: step.workflow.schoolId,
        status: 'rejected',
        message: `Workflow rejected at step ${step.order}`,
      });

      return {
        success: true,
        workflowStatus: 'rejected',
        step: updatedStep,
      };
    }

    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: step.workflowId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    const allApproved = workflow.steps.every((s) => s.status === 'approved');
    const nextStep = workflow.steps.find((s) => s.status === 'pending');

    if (allApproved) {
      await this.prisma.approvalWorkflow.update({
        where: { id: step.workflowId },
        data: {
          status: 'completed',
          finalStatus: 'approved',
          currentStep: workflow.steps.length,
          completedAt: new Date(),
        },
      });

      await this.socketGateway.sendWorkflowUpdate({
        workflowId: step.workflowId,
        documentId: step.workflow.documentId,
        schoolId: step.workflow.schoolId,
        status: 'completed',
        message: 'All approvals completed successfully',
      });

      return {
        success: true,
        workflowStatus: 'completed',
        step: updatedStep,
      };
    }

    if (nextStep) {
      await this.prisma.approvalWorkflow.update({
        where: { id: step.workflowId },
        data: {
          currentStep: nextStep.order,
        },
      });

      await this.socketGateway.sendWorkflowUpdate({
        workflowId: step.workflowId,
        documentId: step.workflow.documentId,
        schoolId: step.workflow.schoolId,
        status: 'in_progress',
        message: `Step ${nextStep.order} now pending approval`,
        nextStep: {
          role: nextStep.role,
          userId: nextStep.userId,
        },
      });
    }

    return {
      success: true,
      workflowStatus: 'in_progress',
      step: updatedStep,
      nextStep,
    };
  }

  async addComment(input: AddCommentInput) {
    this.logger.log(`Adding comment to step: ${input.stepId}`);

    const comment = await this.prisma.approvalComment.create({
      data: {
        stepId: input.stepId,
        userId: input.userId,
        comment: input.comment,
      },
    });

    return comment;
  }

  async getWorkflow(workflowId: string) {
    return this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
          include: {
            approvalComments: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async getDocumentWorkflows(documentId: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: { documentId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSchoolWorkflows(schoolId: string, status?: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        schoolId,
        ...(status ? { status } : {}),
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPendingApprovals(userId: string) {
    return this.prisma.approvalStep.findMany({
      where: {
        userId,
        status: 'pending',
      },
      include: {
        workflow: {
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: [
        { workflow: { createdAt: 'desc' } },
        { order: 'asc' },
      ],
    });
  }
}
