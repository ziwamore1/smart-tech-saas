import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StampMarketplaceService } from './stamp-marketplace.service';
import { StampPermissionService, actorFromRequestUser } from './stamp-permission.service';
import { StampTemplateConfig } from './stamp-engine.types';

/**
 * Super-admin advanced stamp designer + School Stamp Marketplace.
 *
 * /stamp-marketplace/admin/*  → super-admin platform authoring & management
 * /stamp-engine/marketplace/* → school-facing browse / install / uninstall
 *   (installs gated to STANDARD/PREMIUM tiers via each entry's minTier)
 */
@Controller('stamp-marketplace')
@UseGuards(JwtAuthGuard)
export class StampMarketplaceController {
  constructor(
    private service: StampMarketplaceService,
    private permissions: StampPermissionService,
  ) {}

  private actor(req: any) {
    return actorFromRequestUser(req.user);
  }

  // ── Super-admin platform authoring (advanced designer) ──

  @Get('admin/platform')
  listPlatform(@Req() req: any) {
    return { templates: this.service.listPlatform(this.actor(req)) };
  }

  @Get('admin/platform/:id')
  getPlatform(@Req() req: any, @Param('id') id: string) {
    return this.service.getPlatform(this.actor(req), id);
  }

  @Post('admin/platform')
  createPlatform(@Req() req: any, @Body() body: { name: string; type?: string; configJson: StampTemplateConfig }) {
    return this.service.createPlatform(this.actor(req), body);
  }

  @Patch('admin/platform/:id')
  updatePlatform(@Req() req: any, @Param('id') id: string, @Body() body: { name?: string; configJson?: StampTemplateConfig }) {
    return this.service.updatePlatform(this.actor(req), id, body);
  }

  @Delete('admin/platform/:id')
  deletePlatform(@Req() req: any, @Param('id') id: string) {
    return this.service.deletePlatform(this.actor(req), id);
  }

  @Post('admin/platform/:id/publish')
  publishToMarketplace(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name: string; description?: string; category?: string; tags?: string[]; minTier?: any },
  ) {
    return this.service.publishToMarketplace(this.actor(req), id, body);
  }

  @Post('admin/platform/:id/unpublish')
  unpublish(@Req() req: any, @Param('id') id: string) {
    return this.service.unpublishMarketplace(this.actor(req), id);
  }

  @Get('admin/entries')
  async listEntries(@Req() req: any) {
    return { entries: await this.service.listMarketplaceEntries(this.actor(req)) };
  }

  // ── School-facing marketplace ──

  @Get('browse')
  browse(@Req() req: any, @Query('category') category?: string) {
    return { entries: this.service.browse(this.actor(req), category) };
  }

  @Get('installed')
  installed(@Req() req: any) {
    return { entries: this.service.myInstalled(this.actor(req)) };
  }

  @Post('install/:marketplaceId')
  install(@Req() req: any, @Param('marketplaceId') marketplaceId: string) {
    return this.service.install(this.actor(req), marketplaceId);
  }

  @Post('uninstall/:marketplaceId')
  uninstall(@Req() req: any, @Param('marketplaceId') marketplaceId: string) {
    return this.service.uninstall(this.actor(req), marketplaceId);
  }
}
