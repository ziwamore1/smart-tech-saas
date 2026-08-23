import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentHashService } from './document-hash.service';
import { StampTemplateConfig } from './stamp-engine.types';
import { StampTemplateStatus } from '@prisma/client';

export interface TemplateActor {
  userId: string;
  schoolId?: string | null;
  roles: string[];
  isSuperAdmin?: boolean;
}

/**
 * Stamp template lifecycle:
 *
 *   DRAFT  → editable (configJson mutable)
 *   PUBLISHED → immutable snapshot; edits create a NEW DRAFT revision.
 *               Publishing a draft bumps `version` and writes an immutable
 *               StampTemplateVersion row. Historical documents keep the
 *               configSnapshot captured at finalize time, so published
 *               changes never retroactively alter past documents.
 *   ARCHIVED → hidden from selection; existing references keep working.
 */
@Injectable()
export class StampTemplateService {
  constructor(
    private prisma: PrismaService,
    private hashService: DocumentHashService,
  ) {}

  async list(schoolId: string, opts: { includeArchived?: boolean } = {}) {
    return this.prisma.stampTemplate.findMany({
      where: {
        schoolId,
        ...(opts.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async getById(schoolId: string, id: string) {
    const template = await this.prisma.stampTemplate.findFirst({ where: { id, schoolId } });
    if (!template) throw new NotFoundException('Stamp template not found');
    return template;
  }

  async create(
    actor: TemplateActor,
    schoolId: string,
    data: {
      name: string;
      description?: string;
      type?: string;
      configJson: StampTemplateConfig;
      isDefault?: boolean;
    },
  ) {
    this.validateConfig(data.configJson);
    await this.assertUniqueName(schoolId, data.name);

    const template = await this.prisma.stampTemplate.create({
      data: {
        schoolId,
        name: data.name,
        description: data.description,
        type: (data.type as any) || 'CUSTOM',
        status: 'DRAFT',
        version: 1,
        isDefault: data.isDefault ?? false,
        configJson: data.configJson as any,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      },
    });

    // Version 1 snapshot — even drafts are traceable.
    await this.prisma.stampTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        configJson: data.configJson as any,
        changeNote: 'Initial creation',
        createdById: actor.userId,
      },
    });

    if (template.isDefault) await this.clearOtherDefaults(schoolId, template.id);
    return template;
  }

  /** Edit a DRAFT in place; editing a PUBLISHED template creates a new draft copy. */
  async update(
    actor: TemplateActor,
    schoolId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      type: string;
      configJson: StampTemplateConfig;
      isActive: boolean;
    }>,
  ) {
    const template = await this.getById(schoolId, id);
    if (template.status === 'ARCHIVED') throw new BadRequestException('Archived templates cannot be edited');

    if (data.configJson) this.validateConfig(data.configJson);

    let working = template;
    if (template.status === 'PUBLISHED') {
      // Never mutate a published template silently — fork to a draft revision.
      working = await this.prisma.stampTemplate.update({
        where: { id },
        data: {
          name: data.name ? `${data.name} (draft)` : template.name,
          status: 'DRAFT',
          description: data.description ?? template.description,
          type: (data.type as any) ?? template.type,
          configJson: (data.configJson as any) ?? template.configJson,
          updatedBy: actor.userId,
        },
      });
      await this.prisma.stampTemplateVersion.create({
        data: {
          templateId: working.id,
          version: working.version,
          configJson: working.configJson as any,
          changeNote: 'Draft revision forked from published version',
          createdById: actor.userId,
        },
      });
      return working;
    }

    return this.prisma.stampTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        type: data.type as any,
        configJson: data.configJson as any,
        isActive: data.isActive,
        updatedBy: actor.userId,
      },
    });
  }

  async publish(actor: TemplateActor, schoolId: string, id: string, changeNote?: string) {
    const template = await this.getById(schoolId, id);
    if (template.status === 'PUBLISHED') return template;

    const nextVersion =
      template.status === 'DRAFT' && template.publishedAt
        ? template.version + 1 // re-publishing an edited draft bumps the version
        : template.version;

    const published = await this.prisma.$transaction(async tx => {
      const t = await tx.stampTemplate.update({
        where: { id },
        data: { status: 'PUBLISHED', version: nextVersion, publishedAt: new Date(), updatedBy: actor.userId },
      });
      await tx.stampTemplateVersion.upsert({
        where: { templateId_version: { templateId: id, version: nextVersion } },
        update: { configJson: template.configJson as any, changeNote: changeNote ?? `Published v${nextVersion}` },
        create: {
          templateId: id,
          version: nextVersion,
          configJson: template.configJson as any,
          changeNote: changeNote ?? `Published v${nextVersion}`,
          createdById: actor.userId,
        },
      });
      return t;
    });

    return published;
  }

  async archive(actor: TemplateActor, schoolId: string, id: string) {
    await this.getById(schoolId, id);
    return this.prisma.stampTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED', isActive: false, isDefault: false, updatedBy: actor.userId },
    });
  }

  async rollback(actor: TemplateActor, schoolId: string, id: string, toVersion: number) {
    const template = await this.getById(schoolId, id);
    const target = await this.prisma.stampTemplateVersion.findUnique({
      where: { templateId_version: { templateId: id, version: toVersion } },
    });
    if (!target) throw new NotFoundException(`Version ${toVersion} not found`);

    const newVersion = template.version + 1;
    const rolled = await this.prisma.stampTemplate.update({
      where: { id },
      data: {
        configJson: target.configJson,
        version: newVersion,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedBy: actor.userId,
      },
    });
    await this.prisma.stampTemplateVersion.create({
      data: {
        templateId: id,
        version: newVersion,
        configJson: target.configJson,
        changeNote: `Rolled back to v${toVersion}`,
        createdById: actor.userId,
      },
    });
    return rolled;
  }

  async setDefault(schoolId: string, id: string) {
    const template = await this.getById(schoolId, id);
    if (!template.isActive || template.status !== 'PUBLISHED') {
      throw new BadRequestException('Only active published templates can be the default');
    }
    await this.clearOtherDefaults(schoolId, id);
    return this.prisma.stampTemplate.update({ where: { id }, data: { isDefault: true } });
  }

  async getDefault(schoolId: string): Promise<{ id: string } | null> {
    const t = await this.prisma.stampTemplate.findFirst({
      where: { schoolId, isDefault: true, status: 'PUBLISHED', isActive: true },
      select: { id: true },
    });
    return t;
  }

  async listVersions(schoolId: string, id: string) {
    await this.getById(schoolId, id);
    return this.prisma.stampTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { version: 'desc' },
    });
  }

  private async clearOtherDefaults(schoolId: string, keepId: string) {
    await this.prisma.stampTemplate.updateMany({
      where: { schoolId, isDefault: true, id: { not: keepId } },
      data: { isDefault: false },
    });
  }

  private async assertUniqueName(schoolId: string, name: string) {
    const clash = await this.prisma.stampTemplate.findFirst({ where: { schoolId, name }, select: { id: true } });
    if (clash) throw new BadRequestException(`A stamp template named "${name}" already exists`);
  }

  /** Structural validation of the designer JSON (never trust client payloads). */
  private validateConfig(config: any): asserts config is StampTemplateConfig {
    if (!config || typeof config !== 'object') throw new BadRequestException('configJson must be an object');
    if (!Array.isArray(config.layers)) throw new BadRequestException('configJson.layers must be an array');
    if (config.layers.length > 60) throw new BadRequestException('Too many layers (max 60)');
    const ids = new Set<string>();
    for (const [i, layer] of config.layers.entries()) {
      if (!layer?.id || !layer.type) throw new BadRequestException(`Layer ${i} missing id/type`);
      if (ids.has(layer.id)) throw new BadRequestException(`Duplicate layer id "${layer.id}"`);
      ids.add(layer.id);
      if (layer.x == null || layer.y == null) throw new BadRequestException(`Layer ${layer.id} missing x/y`);
    }
    if (config.canvas && (config.canvas.width! > 2000 || config.canvas.height! > 2000)) {
      throw new BadRequestException('Canvas exceeds maximum size (2000x2000)');
    }
  }

  fingerprint(config: unknown): string {
    return this.hashService.fingerprintConfig(config);
  }
}
