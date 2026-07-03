import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TemplateLibraryService } from './template-library.service';
import type { CommCloudChannel } from '../interfaces/message.interface';

@Controller('communications-cloud/templates')
@UseGuards(JwtAuthGuard)
export class TemplateLibraryController {
  constructor(private readonly templateService: TemplateLibraryService) {}

  @Get()
  async getAll(
    @Query('channel') channel?: string,
    @Query('type') type?: string,
    @Query('scope') scope?: string,
    @Query('schoolId') schoolId?: string,
  ) {
    return this.templateService.getTemplates(channel, type, scope, schoolId);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.templateService.getTemplate(id);
  }

  @Post()
  async create(@Body() data: {
    name: string;
    channel: CommCloudChannel;
    type: string;
    subject?: string;
    body: string;
    htmlBody?: string;
    variables?: Record<string, unknown>;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
    category?: string;
    tags?: string[];
  }) {
    return this.templateService.createTemplate(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: {
    name?: string;
    channel?: CommCloudChannel;
    type?: string;
    subject?: string;
    body?: string;
    htmlBody?: string;
    variables?: Record<string, unknown>;
    scope?: string;
    schoolId?: string;
    isDefault?: boolean;
    isActive?: boolean;
    category?: string;
    tags?: string[];
  }) {
    return this.templateService.updateTemplate(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.templateService.deleteTemplate(id);
  }

  @Post(':id/render')
  async render(
    @Param('id') id: string,
    @Body() data: { variables: Record<string, string> },
  ) {
    return this.templateService.renderTemplate(id, data.variables);
  }

  @Post('seed-defaults')
  async seedDefaults() {
    return this.templateService.seedDefaults();
  }
}
