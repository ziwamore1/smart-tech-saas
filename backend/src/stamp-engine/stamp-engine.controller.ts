import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StampPermissionService, ActorContext, actorFromRequestUser } from './stamp-permission.service';
import { StampTemplateService } from './stamp-template.service';
import { StampAssetService } from './stamp-asset.service';
import { StampRendererService } from './stamp-renderer.service';
import { VerificationService } from './verification.service';
import { ApprovalConfigService, ApprovalStepConfig } from './approval-config.service';
import { DocumentAuditService } from './document-audit.service';
import { StampTemplateConfig } from './stamp-engine.types';

/**
 * Digital Stamp Engine — authenticated API.
 * Shares SMART_TECH auth + school context; business logic stays modular.
 */
@Controller('stamp-engine')
@UseGuards(JwtAuthGuard)
export class StampEngineController {
  constructor(
    private permissions: StampPermissionService,
    private templates: StampTemplateService,
    private assets: StampAssetService,
    private renderer: StampRendererService,
    private verification: VerificationService,
    private approvals: ApprovalConfigService,
    private audit: DocumentAuditService,
  ) {}

  private actor(req: any): ActorContext {
    return actorFromRequestUser(req.user);
  }

  private schoolId(req: any): string {
    const schoolId = req.user?.schoolId;
    if (!schoolId) throw new BadRequestException('School context required');
    return schoolId;
  }

  // ── Permissions ──

  @Get('permissions')
  async myPermissions(@Req() req: any) {
    return { permissions: await this.permissions.listForActor(this.actor(req), this.schoolId(req)) };
  }

  // ── Templates ──

  @Get('templates')
  async listTemplates(@Req() req: any) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { templates: await this.templates.list(schoolId) };
  }

  @Get('templates/:id')
  async getTemplate(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return this.templates.getById(schoolId, id);
  }

  @Get('templates/:id/versions')
  async templateVersions(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { versions: await this.templates.listVersions(schoolId, id) };
  }

  @Post('templates')
  async createTemplate(
    @Req() req: any,
    @Body() body: { name: string; description?: string; type?: string; configJson: StampTemplateConfig; isDefault?: boolean },
  ) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_CREATE', { schoolId });
    const t = await this.templates.create(this.actor(req), schoolId, body);
    await this.audit.record({
      schoolId,
      actorId: req.user.id,
      action: 'STAMP_TEMPLATE_CREATED',
      entityType: 'StampTemplate',
      entityId: t.id,
      detail: { name: body.name },
    });
    return t;
  }

  @Patch('templates/:id')
  async updateTemplate(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_EDIT', { schoolId });
    return this.templates.update(this.actor(req), schoolId, id, body);
  }

  @Post('templates/:id/publish')
  async publishTemplate(@Req() req: any, @Param('id') id: string, @Body() body: { changeNote?: string }) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_APPROVE', { schoolId });
    const t = await this.templates.publish(this.actor(req), schoolId, id, body?.changeNote);
    await this.audit.record({
      schoolId,
      actorId: req.user.id,
      action: 'STAMP_TEMPLATE_PUBLISHED',
      entityType: 'StampTemplate',
      entityId: id,
      afterStatus: 'PUBLISHED',
      detail: { version: t.version },
    });
    return t;
  }

  @Post('templates/:id/rollback/:version')
  async rollbackTemplate(@Req() req: any, @Param('id') id: string, @Param('version') version: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_APPROVE', { schoolId });
    return this.templates.rollback(this.actor(req), schoolId, id, parseInt(version, 10));
  }

  @Post('templates/:id/default')
  async setDefault(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_EDIT', { schoolId });
    return this.templates.setDefault(schoolId, id);
  }

  @Delete('templates/:id')
  async archiveTemplate(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_DELETE', { schoolId });
    return this.templates.archive(this.actor(req), schoolId, id);
  }

  // ── Assets (logos / emblems / coats of arms — institution-provided only) ──

  @Get('assets')
  async listAssets(@Req() req: any) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { assets: await this.assets.list(schoolId) };
  }

  @Post('assets/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAsset(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string; kind?: string },
  ) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_CREATE', { schoolId });
    if (!body?.name) throw new BadRequestException('Asset name is required');
    return this.assets.upload(schoolId, req.user.id, file, { name: body.name, kind: body.kind });
  }

  @Delete('assets/:id')
  async deleteAsset(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_DELETE', { schoolId });
    return this.assets.delete(schoolId, id);
  }

  // ── Finalize / verify / revoke ──

  @Post('documents/finalize')
  async finalize(@Req() req: any, @Body() body: any) {
    const schoolId = this.schoolId(req);
    const result = await this.verification.finalize({
      actor: this.actor(req),
      schoolId,
      documentId: body.documentId,
      documentType: body.documentType,
      documentTitle: body.documentTitle,
      issuedToLabel: body.issuedToLabel,
      documentData: body.documentData,
      stampTemplateId: body.stampTemplateId,
      serialPolicy: body.serialPolicy,
      timezone: body.timezone,
      expiresAt: body.expiresAt ?? null,
      signatureRecordId: body.signatureRecordId,
      approvals: body.approvals,
      disclaimerText: body.disclaimerText,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return result;
  }

  @Post('documents/:verificationId/supersede')
  async supersede(@Req() req: any, @Param('verificationId') verificationId: string, @Body() body: any) {
    const schoolId = this.schoolId(req);
    return this.verification.supersede(this.actor(req), schoolId, verificationId, body);
  }

  @Post('documents/:verificationId/revoke')
  async revoke(
    @Req() req: any,
    @Param('verificationId') verificationId: string,
    @Body() body: { reason: string },
  ) {
    const schoolId = this.schoolId(req);
    if (!body?.reason) throw new BadRequestException('Revocation reason is required');
    const updated = await this.verification.revoke(this.actor(req), schoolId, verificationId, body.reason, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return { success: true, status: updated.status };
  }

  @Get('documents')
  async listDocuments(@Req() req: any) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { documents: await this.verification.listForSchool(schoolId, req.query || {}) };
  }

  @Get('documents/:id')
  async getDocument(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return this.verification.getByIdOwned(schoolId, id);
  }

  @Get('documents/:id/audit-trail')
  async auditTrail(@Req() req: any, @Param('id') id: string) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { trail: await this.verification.getAuditTrail(schoolId, id) };
  }

  // ── Configurable approval workflows ──

  @Get('approval-configs')
  async listApprovalConfigs(@Req() req: any) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_VIEW', { schoolId });
    return { configs: await this.approvals.list(schoolId) };
  }

  @Post('approval-configs')
  async createApprovalConfig(
    @Req() req: any,
    @Body() body: { documentType: string; name: string; steps: ApprovalStepConfig[]; requiresSigner?: boolean },
  ) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_APPROVE', { schoolId });
    return this.approvals.create(schoolId, req.user.id, body);
  }

  @Patch('approval-configs/:id')
  async updateApprovalConfig(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { steps?: ApprovalStepConfig[]; isActive?: boolean; name?: string },
  ) {
    const schoolId = this.schoolId(req);
    await this.permissions.assert(this.actor(req), 'DOCUMENT_STAMP_APPROVE', { schoolId });
    return this.approvals.update(schoolId, id, body);
  }

  // ── Render preview (designer live preview uses the same engine server-side) ──

  @Post('render-preview')
  async renderPreview(
    @Req() req: any,
    @Body() body: { configJson: StampTemplateConfig; assetIds?: string[] },
  ) {
    const actor = this.actor(req);
    // Super admins preview platform-authored stamps without a school context.
    const schoolId = actor.isSuperAdmin ? null : this.schoolId(req);
    await this.permissions.assert(actor, 'DOCUMENT_STAMP_VIEW', { schoolId: schoolId || undefined });
    // Preview renders placeholder date/serial — nothing authoritative leaks,
    // and only assets belonging to this school can be referenced.
    const owned = schoolId
      ? await this.assets.resolveAssetMap(schoolId, body.assetIds || [])
      : {};
    const svg = this.renderer.render(body.configJson, {
      serialNumber: 'STS-PREVIEW',
      stampDate: '01 JAN 2030',
      stampTime: '00:00:00',
      timezoneLabel: 'CAT',
      assets: owned,
    });
    return { svg };
  }
}
