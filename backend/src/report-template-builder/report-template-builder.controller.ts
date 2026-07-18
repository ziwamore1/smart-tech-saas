import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
  Query,
  Res,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportTemplateBuilderService } from './report-template-builder.service';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificateRendererService } from './certificate-renderer.service';
import { TemplateRendererService } from './template-renderer.service';
import { AiTemplateGeneratorService } from './ai-template-generator.service';
import { BrandingPresetService } from './branding-preset.service';
import { TemplateMarketplaceService } from './template-marketplace.service';
import { CloudAssetService } from './cloud-asset.service';
import { DigitalSignatureService } from './digital-signature.service';
import { DigitalStampService } from './digital-stamp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('template-builder')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportTemplateBuilderController {
  private readonly logger = new Logger(ReportTemplateBuilderController.name);

  constructor(
    private readonly builderService: ReportTemplateBuilderService,
    private readonly certificateService: CertificateTemplateService,
    private readonly certificateRendererService: CertificateRendererService,
    private readonly rendererService: TemplateRendererService,
    private readonly aiGeneratorService: AiTemplateGeneratorService,
    private readonly brandingService: BrandingPresetService,
    private readonly marketplaceService: TemplateMarketplaceService,
    private readonly cloudAssetService: CloudAssetService,
    private readonly signatureService: DigitalSignatureService,
    private readonly digitalStampService: DigitalStampService,
  ) {}

  @Get('components')
  @Roles('Director', 'Teacher')
  async getAvailableComponents() {
    return this.builderService.getAvailableComponents();
  }

  @Get('categories')
  @Roles('Director', 'Teacher')
  async getCategories(@Req() req) {
    return this.builderService.getCategories(req.user.schoolId);
  }

  @Post('categories')
  @Roles('Director')
  async createCategory(@Req() req, @Body() data: any) {
    return this.builderService.createCategory(req.user.schoolId, data);
  }

  @Delete('categories/:id')
  @Roles('Director')
  async deleteCategory(@Req() req, @Param('id') id: string) {
    return this.builderService.deleteCategory(req.user.schoolId, id);
  }

  @Get('assets')
  @Roles('Director', 'Teacher')
  async getAssets(@Req() req, @Query('type') type?: string) {
    return this.builderService.getAssets(req.user.schoolId, type);
  }

  @Post('assets')
  @Roles('Director')
  async createAsset(@Req() req, @Body() data: any) {
    return this.builderService.createAsset(req.user.schoolId, data);
  }

  @Delete('assets/:id')
  @Roles('Director')
  async deleteAsset(@Req() req, @Param('id') id: string) {
    return this.builderService.deleteAsset(req.user.schoolId, id);
  }

  @Get()
  @Roles('Director', 'Teacher')
  async getTemplates(
    @Req() req,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.builderService.getTemplates(req.user.schoolId, { type, status, categoryId });
  }

  @Get('stats')
  @Roles('Director', 'Teacher')
  async getStats() {
    return this.builderService.getStats();
  }

  @Get('marketplace')
  @Roles('Director', 'Teacher')
  async getMarketplace(
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('search') search?: string,
  ) {
    return this.marketplaceService.getMarketplaceTemplates({
      category,
      featured: featured === 'true',
      search,
    });
  }

  @Get('cloud-assets')
  @Roles('Director', 'Teacher')
  async getCloudAssets(
    @Req() req,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.cloudAssetService.getAssets(req.user.schoolId, type, search);
  }

  @Get('signatures')
  @Roles('Director', 'Teacher')
  async getSignatures(@Req() req) {
    return this.signatureService.getSignatures(req.user.schoolId);
  }

  @Get('stamps')
  @Roles('Director', 'Teacher')
  async getStamps(@Req() req, @Query('type') type?: string) {
    return this.digitalStampService.getStamps(req.user.schoolId, type);
  }

  @Get('branding')
  @Roles('Director', 'Teacher')
  async getBrandingPresets(@Req() req) {
    return this.brandingService.getPresets(req.user.schoolId);
  }

  @Get(':id')
  @Roles('Director', 'Teacher')
  async getTemplate(@Req() req, @Param('id') id: string) {
    return this.builderService.getTemplate(id, req.user.schoolId);
  }

  @Post()
  @Roles('Director')
  async createTemplate(@Req() req, @Body() data: any) {
    return this.builderService.createTemplate(req.user.schoolId, data);
  }

  @Patch(':id')
  @Roles('Director')
  async updateTemplate(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.builderService.updateTemplate(req.user.schoolId, id, data);
  }

  @Delete(':id')
  @Roles('Director')
  async deleteTemplate(@Req() req, @Param('id') id: string) {
    return this.builderService.deleteTemplate(req.user.schoolId, id);
  }

  @Post(':id/duplicate')
  @Roles('Director')
  async duplicateTemplate(@Req() req, @Param('id') id: string) {
    return this.builderService.duplicateTemplate(req.user.schoolId, id);
  }

  @Post(':id/publish')
  @Roles('Director')
  async publishTemplate(@Req() req, @Param('id') id: string) {
    return this.builderService.publishTemplate(req.user.schoolId, id);
  }

  @Post(':id/archive')
  @Roles('Director')
  async archiveTemplate(@Req() req, @Param('id') id: string) {
    return this.builderService.archiveTemplate(req.user.schoolId, id);
  }

  @Post(':id/layout')
  @Roles('Director')
  async saveLayout(@Req() req, @Param('id') id: string, @Body('layout') layout: any) {
    return this.builderService.saveLayout(req.user.schoolId, id, layout);
  }

  @Post(':id/components')
  @Roles('Director')
  async addComponent(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.builderService.addComponent(req.user.schoolId, id, data);
  }

  @Patch(':id/components/:componentId')
  @Roles('Director')
  async updateComponent(
    @Req() req,
    @Param('id') id: string,
    @Param('componentId') componentId: string,
    @Body() data: any,
  ) {
    return this.builderService.updateComponent(req.user.schoolId, id, componentId, data);
  }

  @Delete(':id/components/:componentId')
  @Roles('Director')
  async deleteComponent(@Req() req, @Param('id') id: string, @Param('componentId') componentId: string) {
    return this.builderService.deleteComponent(req.user.schoolId, id, componentId);
  }

  @Post(':id/components/reorder')
  @Roles('Director')
  async reorderComponents(@Req() req, @Param('id') id: string, @Body('order') order: { id: string; sortOrder: number }[]) {
    return this.builderService.reorderComponents(req.user.schoolId, id, order);
  }

  @Get(':id/certificate')
  @Roles('Director', 'Teacher')
  async getCertificateSettings(@Req() req, @Param('id') id: string) {
    return this.certificateService.getCertificateSettings(req.user.schoolId, id);
  }

  @Patch(':id/certificate')
  @Roles('Director')
  async updateCertificateSettings(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.certificateService.updateCertificateSettings(req.user.schoolId, id, data);
  }

  @Get(':id/certificate/number')
  @Roles('Director', 'Teacher')
  async getNextCertificateNumber(@Req() req, @Param('id') id: string) {
    return this.certificateService.getNextCertificateNumber(req.user.schoolId, id);
  }

  @Post(':id/preview')
  @Roles('Director', 'Teacher')
  async renderPreview(@Req() req, @Param('id') id: string, @Body('data') data?: any) {
    const html = await this.rendererService.renderPreview(req.user.schoolId, id, data);
    return { html };
  }

  @Post(':id/certificate/render')
  @Roles('Director', 'Teacher')
  async renderCertificate(
    @Req() req,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const template = await this.builderService.getTemplate(id, req.user.schoolId);
    const school = await this.rendererService.getSchool(req.user.schoolId);
    const cert = await this.certificateService.getCertificateSettings(req.user.schoolId, id);

    const certNumber = await this.certificateService.getNextCertificateNumber(req.user.schoolId, id);
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const verificationUrl = await this.certificateRendererService.createVerificationUrl(baseUrl, certNumber || id);

    let stamps: any[] = [];
    try {
      stamps = await this.digitalStampService.getTemplateStamps(req.user.schoolId, id);
    } catch {
      // Stamps are optional
    }

    const html = await this.certificateRendererService.generateCertificateHtml(
      body.canvasJson || {},
      {
        schoolName: school?.name || '',
        studentName: body.studentName || 'Student Name',
        className: body.className || '',
        termName: body.termName || '',
        academicYear: body.academicYear || '',
        certificateNumber: certNumber || 'XXXXXX',
        verificationUrl,
        schoolLogo: school?.logoUrl || school?.logo,
        studentPhoto: body.studentPhoto,
        signature1Name: cert?.signature1Name,
        signature1Label: cert?.signature1Label,
        signature2Name: cert?.signature2Name,
        signature2Label: cert?.signature2Label,
        awardText: cert?.awardText,
        borderStyle: cert?.borderStyle || 'classic',
        borderColor: cert?.borderColor || '#1a365d',
        showQrCode: cert?.showQrCode !== false,
        showBadge: cert?.showBadge !== false,
        badgeStyle: cert?.badgeStyle || 'star',
        showWatermark: cert?.showWatermark || false,
        watermarkText: cert?.watermarkText,
        orientation: template?.orientation || 'landscape',
        pageSize: template?.pageSize || 'A4',
        stamps,
      },
    );

    return { html };
  }

  @Post(':id/certificate/qr')
  @Roles('Director', 'Teacher')
  async generateQr(@Param('id') id: string, @Body('data') data: string) {
    const qr = await this.certificateRendererService.generateQrCodeDataUrl(data || id);
    return { qr };
  }

  @Post(':id/certificate/pdf')
  @Roles('Director', 'Teacher')
  async renderCertificatePdf(
    @Req() req,
    @Param('id') id: string,
    @Body() body: any,
    @Res() res: any,
  ) {
    const htmlResult = await this.renderCertificate(req, id, body);
    const result = await this.rendererService.renderPdfFromHtml(req.user.schoolId, id, htmlResult.html);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${id}.pdf"`,
    });
    res.send(result.buffer);
  }

  @Post(':id/pdf')
  @Roles('Director', 'Teacher')
  async renderPdf(
    @Req() req,
    @Param('id') id: string,
    @Body('data') data?: any,
    @Res() res?: Response,
  ) {
    const result = await this.rendererService.renderPdf(req.user.schoolId, id, data);
    res!.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-${id}.pdf"`,
    });
    res!.send(result.buffer);
  }

  // ===== AI Template Generator Routes =====

  @Post('ai/generate-layout')
  @Roles('Director')
  async generateAILayout(@Req() req, @Body() body: { templateType: string; preferences?: any }) {
    return this.aiGeneratorService.generateLayout(body.templateType, req.user.schoolId, body.preferences);
  }

  @Get('ai/suggestions')
  @Roles('Director', 'Teacher')
  async getAISuggestions() {
    return this.aiGeneratorService.getAITemplateSuggestions();
  }

  @Post('ai/suggest-from-student')
  @Roles('Director', 'Teacher')
  async suggestFromStudentData(@Req() req, @Body('studentId') studentId: string) {
    return this.aiGeneratorService.suggestTemplateFromStudentData(studentId, req.user.schoolId);
  }

  // ===== Branding Preset Routes =====

  @Get('branding/:id')
  @Roles('Director', 'Teacher')
  async getBrandingPreset(@Req() req, @Param('id') id: string) {
    return this.brandingService.getPreset(req.user.schoolId, id);
  }

  @Post('branding')
  @Roles('Director')
  async createBrandingPreset(@Req() req, @Body() data: any) {
    return this.brandingService.createPreset(req.user.schoolId, data);
  }

  @Patch('branding/:id')
  @Roles('Director')
  async updateBrandingPreset(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.brandingService.updatePreset(req.user.schoolId, id, data);
  }

  @Delete('branding/:id')
  @Roles('Director')
  async deleteBrandingPreset(@Req() req, @Param('id') id: string) {
    return this.brandingService.deletePreset(req.user.schoolId, id);
  }

  @Post('branding/apply')
  @Roles('Director')
  async applyBranding(@Req() req, @Body() body: { templateId: string; presetId: string }) {
    return this.brandingService.applyPresetToTemplate(req.user.schoolId, body.templateId, body.presetId);
  }

  // ===== Template Marketplace Routes =====

  @Get('marketplace/categories')
  @Roles('Director', 'Teacher')
  async getMarketplaceCategories() {
    return this.marketplaceService.getCategories();
  }

  @Post('marketplace/:templateId')
  @Roles('Director')
  async publishToMarketplace(@Req() req, @Param('templateId') templateId: string, @Body() data: any) {
    return this.marketplaceService.publishToMarketplace(req.user.schoolId, templateId, data);
  }

  @Post('marketplace/download/:marketplaceId')
  @Roles('Director', 'Teacher')
  async downloadFromMarketplace(@Req() req, @Param('marketplaceId') marketplaceId: string) {
    const start = Date.now();
    this.logger.log(`downloadTemplate start - marketplaceId=${marketplaceId} schoolId=${req.user.schoolId}`);
    const result = await this.marketplaceService.downloadTemplate(req.user.schoolId, marketplaceId);
    this.logger.log(`downloadTemplate done - took ${Date.now() - start}ms`);
    return result;
  }

  @Post('marketplace/like/:marketplaceId')
  @Roles('Director', 'Teacher')
  async likeMarketplaceItem(@Param('marketplaceId') marketplaceId: string) {
    return this.marketplaceService.likeTemplate(marketplaceId);
  }

  // ===== Cloud Asset Routes =====

  @Get('cloud-assets/categories')
  @Roles('Director', 'Teacher')
  async getAssetCategories() {
    return this.cloudAssetService.getAssetCategories();
  }

  @Post('cloud-assets')
  @Roles('Director')
  async createCloudAsset(@Req() req, @Body() data: any) {
    return this.cloudAssetService.uploadAsset(req.user.schoolId, data);
  }

  @Delete('cloud-assets/:id')
  @Roles('Director')
  async deleteCloudAsset(@Req() req, @Param('id') id: string) {
    return this.cloudAssetService.deleteAsset(req.user.schoolId, id);
  }

  @Get('cloud-assets/:id/usage')
  @Roles('Director', 'Teacher')
  async getAssetUsage(@Req() req, @Param('id') id: string) {
    return this.cloudAssetService.getAssetUsage(req.user.schoolId, id);
  }

  // ===== Digital Signature Routes =====

  @Post('signatures')
  @Roles('Director')
  async createSignature(@Req() req, @Body() data: any) {
    return this.signatureService.createSignature(req.user.schoolId, data);
  }

  @Patch('signatures/:id')
  @Roles('Director')
  async updateSignature(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.signatureService.updateSignature(req.user.schoolId, id, data);
  }

  @Delete('signatures/:id')
  @Roles('Director')
  async deleteSignature(@Req() req, @Param('id') id: string) {
    return this.signatureService.deleteSignature(req.user.schoolId, id);
  }

  @Post('signatures/sign')
  @Roles('Director')
  async signDocument(@Req() req, @Body() body: { signatureId: string; documentHash: string }) {
    return this.signatureService.signDocument(req.user.schoolId, body.signatureId, body.documentHash);
  }

  // ===== Digital Stamp Routes =====

  @Get('stamps/:id')
  @Roles('Director', 'Teacher')
  async getStamp(@Req() req, @Param('id') id: string) {
    return this.digitalStampService.getStamp(req.user.schoolId, id);
  }

  @Post('stamps')
  @Roles('Director')
  async createStamp(@Req() req, @Body() data: any) {
    return this.digitalStampService.createStamp(req.user.schoolId, data);
  }

  @Patch('stamps/:id')
  @Roles('Director')
  async updateStamp(@Req() req, @Param('id') id: string, @Body() data: any) {
    return this.digitalStampService.updateStamp(req.user.schoolId, id, data);
  }

  @Delete('stamps/:id')
  @Roles('Director')
  async deleteStamp(@Req() req, @Param('id') id: string) {
    return this.digitalStampService.deleteStamp(req.user.schoolId, id);
  }

  @Post('stamps/:id/duplicate')
  @Roles('Director')
  async duplicateStamp(@Req() req, @Param('id') id: string) {
    return this.digitalStampService.duplicateStamp(req.user.schoolId, id);
  }

  @Get('stamps/defaults')
  @Roles('Director', 'Teacher')
  async getDefaultStamps(@Req() req) {
    return this.digitalStampService.getDefaultStamps(req.user.schoolId);
  }

  // Template-Stamp assignment
  @Get('templates/:templateId/stamps')
  @Roles('Director', 'Teacher')
  async getTemplateStamps(@Req() req, @Param('templateId') templateId: string) {
    return this.digitalStampService.getTemplateStamps(req.user.schoolId, templateId);
  }

  @Post('templates/:templateId/stamps')
  @Roles('Director')
  async assignStampToTemplate(
    @Req() req,
    @Param('templateId') templateId: string,
    @Body() body: { stampId: string; positionX?: number; positionY?: number; width?: number; height?: number; rotation?: number; opacity?: number; layerOrder?: number }
  ) {
    const { stampId, positionX, positionY, ...rest } = body;
    return this.digitalStampService.assignStampToTemplate(req.user.schoolId, templateId, stampId, { x: positionX, y: positionY, ...rest });
  }

  @Patch('template-stamps/:templateStampId')
  @Roles('Director')
  async updateTemplateStamp(@Req() req, @Param('templateStampId') templateStampId: string, @Body() data: any) {
    return this.digitalStampService.updateTemplateStamp(req.user.schoolId, templateStampId, data);
  }

  @Delete('template-stamps/:templateStampId')
  @Roles('Director')
  async removeTemplateStamp(@Req() req, @Param('templateStampId') templateStampId: string) {
    return this.digitalStampService.removeTemplateStamp(req.user.schoolId, templateStampId);
  }

  // Verification
  @Post('stamps/verify')
  @Roles('Director', 'Teacher')
  async createStampVerification(@Req() req, @Body() body: { documentId: string; documentType: string; stampId?: string; metadata?: any }) {
    return this.digitalStampService.createStampVerification({ ...body, schoolId: req.user.schoolId });
  }

  @Get('stamps/verify/:verificationHash')
  async verifyDocument(@Param('verificationHash') verificationHash: string) {
    return this.digitalStampService.verifyDocument(verificationHash);
  }

  @Get('stamps/verify/document/:documentId')
  @Roles('Director', 'Teacher')
  async getVerificationStatus(@Req() req, @Param('documentId') documentId: string) {
    return this.digitalStampService.getVerificationStatus(documentId);
  }
}
