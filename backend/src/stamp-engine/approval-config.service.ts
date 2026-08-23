import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ApprovalStepConfig {
  order: number;
  role?: string; // any holder of this school role may approve
  userId?: string; // specific approver
  label?: string;
  requireSignature?: boolean;
}

/**
 * Configurable, per-school approval chains.
 * Different institutions require different review paths — nothing is hardcoded.
 * Evaluation is pure: given a config + actor roles, can finalization proceed?
 */
@Injectable()
export class ApprovalConfigService {
  constructor(private prisma: PrismaService) {}

  async list(schoolId: string) {
    return this.prisma.approvalWorkflowConfig.findMany({
      where: { schoolId },
      orderBy: [{ documentType: 'asc' }, { name: 'asc' }],
    });
  }

  async create(
    schoolId: string,
    userId: string,
    data: { documentType: string; name: string; steps: ApprovalStepConfig[]; requiresSigner?: boolean },
  ) {
    this.validateSteps(data.steps);
    return this.prisma.approvalWorkflowConfig.create({
      data: {
        schoolId,
        documentType: data.documentType.toUpperCase(),
        name: data.name,
        stepsJson: data.steps as any,
        requiresSigner: data.requiresSigner ?? true,
        createdById: userId,
      },
    });
  }

  async update(schoolId: string, id: string, data: Partial<{ steps: ApprovalStepConfig[]; isActive: boolean; name: string }>) {
    const cfg = await this.prisma.approvalWorkflowConfig.findFirst({ where: { id, schoolId } });
    if (!cfg) throw new NotFoundException('Approval workflow config not found');
    if (data.steps) this.validateSteps(data.steps);
    return this.prisma.approvalWorkflowConfig.update({
      where: { id },
      data: {
        stepsJson: data.steps ? (data.steps as any) : undefined,
        isActive: data.isActive,
        name: data.name,
      },
    });
  }

  /** Active config for a document type, falling back to the legacy default. */
  async resolveForDocumentType(schoolId: string, documentType: string): Promise<{
    configId: string | null;
    name: string;
    steps: ApprovalStepConfig[];
    requiresSigner: boolean;
  }> {
    const cfg = await this.prisma.approvalWorkflowConfig.findFirst({
      where: { schoolId, documentType: documentType.toUpperCase(), isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (cfg) {
      return {
        configId: cfg.id,
        name: cfg.name,
        steps: (cfg.stepsJson as any) || [],
        requiresSigner: cfg.requiresSigner,
      };
    }
    return { configId: null, name: 'default', steps: [], requiresSigner: true };
  }

  /**
   * Evaluate whether an approval chain has been satisfied for finalization.
   * `approvals` maps step order → { approvedByUserId, roles[], signed }.
   */
  evaluateChain(config: { steps: ApprovalStepConfig[] }, approvals: Array<{ order: number; approvedById: string; approvedByRoles: string[]; signed: boolean }>, signerHasPermission: boolean): { satisfied: boolean; missingSteps: number[] } {
    if (!config.steps.length) return { satisfied: true, missingSteps: [] };

    const missing: number[] = [];
    for (const step of [...config.steps].sort((a, b) => a.order - b.order)) {
      const record = approvals.find(a => a.order === step.order);
      if (!record) {
        missing.push(step.order);
        continue;
      }
      const roleOk = step.role
        ? record.approvedByRoles.some(r => r.toLowerCase() === step.role!.toLowerCase())
        : true;
      const userOk = step.userId ? record.approvedById === step.userId : true;
      const signOk = step.requireSignature ? record.signed : true;
      if (!roleOk || !userOk || !signOk) missing.push(step.order);
    }
    void signerHasPermission;
    return { satisfied: missing.length === 0, missingSteps: missing };
  }

  private validateSteps(steps: ApprovalStepConfig[]) {
    if (!Array.isArray(steps)) throw new BadRequestException('steps must be an array');
    for (const [i, s] of steps.entries()) {
      if (!s.role && !s.userId) {
        throw new BadRequestException(`Step ${i} requires either a role or userId`);
      }
    }
  }
}
