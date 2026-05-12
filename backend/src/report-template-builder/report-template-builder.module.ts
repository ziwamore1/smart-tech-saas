import { Module } from '@nestjs/common';
import { ReportTemplateBuilderController } from './report-template-builder.controller';
import { ReportTemplateBuilderService } from './report-template-builder.service';
import { CertificateTemplateService } from './certificate-template.service';
import { CertificateRendererService } from './certificate-renderer.service';
import { TemplateRendererService } from './template-renderer.service';
import { AiTemplateGeneratorService } from './ai-template-generator.service';
import { BrandingPresetService } from './branding-preset.service';
import { TemplateMarketplaceService } from './template-marketplace.service';
import { CloudAssetService } from './cloud-asset.service';
import { DigitalSignatureService } from './digital-signature.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReportTemplateBuilderController],
  providers: [
    ReportTemplateBuilderService,
    CertificateTemplateService,
    CertificateRendererService,
    TemplateRendererService,
    AiTemplateGeneratorService,
    BrandingPresetService,
    TemplateMarketplaceService,
    CloudAssetService,
    DigitalSignatureService,
    PrismaService,
  ],
  exports: [
    ReportTemplateBuilderService,
    CertificateTemplateService,
    CertificateRendererService,
    TemplateRendererService,
    AiTemplateGeneratorService,
    BrandingPresetService,
    TemplateMarketplaceService,
    CloudAssetService,
    DigitalSignatureService,
  ],
})
export class ReportTemplateBuilderModule {}
