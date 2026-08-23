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
import { DigitalStampService } from './digital-stamp.service';
import { CertificateCommentService } from './certificate-comment.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureLockModule } from '../feature-lock/feature-lock.module';
import { StampEngineModule } from '../stamp-engine/stamp-engine.module';

@Module({
  imports: [FeatureLockModule, StampEngineModule],
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
    DigitalStampService,
    CertificateCommentService,
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
    DigitalStampService,
    CertificateCommentService,
  ],
})
export class ReportTemplateBuilderModule {}
