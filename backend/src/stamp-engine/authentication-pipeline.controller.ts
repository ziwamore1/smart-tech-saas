import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthenticationPipelineService, IssueDocumentInput } from './authentication-pipeline.service';
import { StampPermissionService } from './stamp-permission.service';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';

class PrepareDto {
  @IsString() schoolId!: string;
  @IsString() documentId!: string;
  @IsString() documentType!: string;
  @IsOptional() @IsString() documentTitle?: string;
  @IsOptional() stampTemplateId?: string;
  @IsBoolean() requiresSignature!: boolean;
  @IsOptional() @IsArray() signers?: Array<{ signerId: string; signerRole?: string; signerName?: string }>;
  @IsOptional() @IsArray() signatories?: Array<{ label: string; role?: string; userId?: string; signatureId: string }>;
}

class IssueDto extends PrepareDto {
  @IsOptional() documentData?: Record<string, any>;
  @IsOptional() issuedToLabel?: string;
  @IsOptional() organizationRef?: string;
  @IsOptional() serialPolicy?: Record<string, unknown>;
  @IsOptional() timezone?: string;
  @IsOptional() expiresAt?: string | null;
  @IsOptional() approvals?: Array<{ order: number; approvedById: string; approvedByRoles: string[]; signed: boolean }>;
  @IsOptional() @MaxLength(300) disclaimerText?: string;
}

export class RevokeAuthDto {
  @IsString() reason!: string;
}

export class SupersedeAuthDto {
  @IsString() newAuthenticationId!: string;
}

/**
 * Unified Document Authentication pipeline — one professional workflow:
 * generate → stamp → sign → register → verify. Users never see the plumbing.
 */
@Controller('stamp-engine/document-authentication')
export class DocumentAuthenticationController {
  constructor(
    private pipeline: AuthenticationPipelineService,
    private verification: VerificationService,
    private permissions: StampPermissionService,
    private prisma: PrismaService,
  ) {}

  private actor(req: any) {
    return {
      userId: req.user.id,
      schoolId: req.user.schoolId,
      roles: req.user.roles || [],
      isSuperAdmin: req.user.isSuperAdmin,
    };
  }

  private schoolId(req: any, override?: string): string {
    const id = override || req.user.schoolId;
    if (!id) throw new Error('schoolId required');
    return id;
  }

  /** Marketplace integration: what does this report template require? */
  @Get('capabilities')
  async capabilities(@Req() req: any, @Query('templateId') templateId?: string) {
    const fallback = { stamp: true, signature: Boolean(process.env.SIGNATURE_SERVICE_URL), verification: true };
    if (!templateId) return { capabilities: fallback, source: 'default' };
    const tpl = await this.prisma.reportTemplate.findFirst({
      where: { id: templateId },
      select: { layoutJson: true, includeStamp: true, includeSignature: true },
    });
    return {
      capabilities: tpl
        ? this.pipeline.resolveCapabilities({ ...((tpl.layoutJson ?? {}) as object), requiresStamp: tpl.includeStamp, requiresSignature: tpl.includeSignature })
        : fallback,
      source: tpl ? 'template' : 'default',
    };
  }

  @Post('prepare')
  async prepare(@Req() req: any, @Body() dto: PrepareDto) {
    return {
      plan: await this.pipeline.prepare(this.toInput(dto, this.schoolId(req, dto.schoolId), this.actor(req))),
    };
  }

  @Post('issue')
  async issue(@Req() req: any, @Body() dto: IssueDto) {
    return this.pipeline.issue(this.toInput(dto, this.schoolId(req, dto.schoolId), this.actor(req)));
  }

  @Get('records')
  async records(@Req() req: any, @Query('status') status?: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { records: await this.pipeline.list(schoolId, { status }) };
  }

  @Get(':idOrSerial')
  async get(@Req() req: any, @Param('idOrSerial') idOrSerial: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return this.pipeline.get(schoolId, idOrSerial);
  }

  @Get(':idOrSerial/pipeline-trace')
  async trace(@Req() req: any, @Param('idOrSerial') idOrSerial: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_APPROVE', { schoolId });
    return { steps: await this.pipeline.auditTrail(schoolId, idOrSerial) };
  }

  @Post(':idOrSerial/revoke')
  async revoke(@Req() req: any, @Param('idOrSerial') idOrSerial: string, @Body() dto: RevokeAuthDto) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_REVOKE', { schoolId });
    return this.pipeline.revoke(schoolId, req.user.id, idOrSerial, dto.reason);
  }

  @Post(':idOrSerial/supersede')
  async supersede(@Req() req: any, @Param('idOrSerial') idOrSerial: string, @Body() dto: SupersedeAuthDto) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_APPLY', { schoolId });
    return this.pipeline.supersede(schoolId, req.user.id, idOrSerial, dto.newAuthenticationId);
  }

  /** Stamp-only issuance path kept for backward compatibility. */
  @Post('stamp-only')
  async stampOnly(@Req() req: any, @Body() dto: IssueDto) {
    const result = await this.verification.finalize({
      actor: this.actor(req),
      schoolId: this.schoolId(req, dto.schoolId),
      documentId: dto.documentId,
      documentType: dto.documentType,
      documentTitle: dto.documentTitle,
      issuedToLabel: dto.issuedToLabel,
      documentData: dto.documentData,
      stampTemplateId: dto.stampTemplateId,
      serialPolicy: dto.serialPolicy as any,
      timezone: dto.timezone,
      expiresAt: dto.expiresAt,
      approvals: dto.approvals,
      disclaimerText: dto.disclaimerText,
    });
    return { ...result, signatures: [] };
  }

  private toInput(dto: PrepareDto | IssueDto, schoolId: string, actor: { userId: string; schoolId?: string | null; roles: string[]; isSuperAdmin?: boolean }): IssueDocumentInput {
    return {
      actor,
      schoolId,
      documentId: dto.documentId,
      documentType: dto.documentType,
      documentTitle: dto.documentTitle,
      issuedToLabel: (dto as IssueDto).issuedToLabel,
      documentData: (dto as IssueDto).documentData,
      stampTemplateId: dto.stampTemplateId,
      requiresSignature: dto.requiresSignature,
      signers: dto.signers || [],
      signatories: (dto as IssueDto).signatories,
      organizationRef: (dto as IssueDto).organizationRef,
      serialPolicy: (dto as IssueDto).serialPolicy as any,
      timezone: (dto as IssueDto).timezone,
      expiresAt: (dto as IssueDto).expiresAt ?? null,
      approvals: (dto as IssueDto).approvals,
      disclaimerText: (dto as IssueDto).disclaimerText,
    };
  }
}
