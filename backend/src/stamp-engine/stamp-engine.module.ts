import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { StampEngineController } from './stamp-engine.controller';
import { PublicVerificationController } from './public-verification.controller';
import { DocumentAuthenticationController } from './authentication-pipeline.controller';
import { StampPermissionService } from './stamp-permission.service';
import { StampTemplateService } from './stamp-template.service';
import { StampAssetService } from './stamp-asset.service';
import { StampRendererService } from './stamp-renderer.service';
import { SerialNumberService } from './serial-number.service';
import { DocumentHashService } from './document-hash.service';
import { VerificationService } from './verification.service';
import { ApprovalConfigService } from './approval-config.service';
import { DocumentAuditService } from './document-audit.service';
import { SignatureBridgeService } from './signature-bridge.service';
import { CanonicalPayloadService } from './canonical-payload.service';
import { AuthenticationPipelineService } from './authentication-pipeline.service';

/**
 * Digital Stamp Engine — internal SMART_TECH microservice/module.
 *
 * Shares platform authentication, school context, storage and PDF
 * infrastructure; all business logic is encapsulated here and exported for
 * reuse (report engine finalize flows, batch workers, etc.).
 *
 * The unified Document Authentication pipeline composes this engine with the
 * independent Digital Signature Service through SignatureBridgeService using
 * the internal service contract (x-service-key authenticated).
 */
@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [StampEngineController, PublicVerificationController, DocumentAuthenticationController],
  providers: [
    StampPermissionService,
    StampTemplateService,
    StampAssetService,
    StampRendererService,
    SerialNumberService,
    DocumentHashService,
    VerificationService,
    ApprovalConfigService,
    DocumentAuditService,
    SignatureBridgeService,
    CanonicalPayloadService,
    AuthenticationPipelineService,
  ],
  exports: [
    // Composable building blocks for other modules (report-engine, report-queue…)
    StampRendererService,
    SerialNumberService,
    DocumentHashService,
    VerificationService,
    ApprovalConfigService,
    DocumentAuditService,
    StampPermissionService,
    SignatureBridgeService,
    CanonicalPayloadService,
    AuthenticationPipelineService,
  ],
})
export class StampEngineModule {}
