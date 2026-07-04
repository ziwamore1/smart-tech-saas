import {
  Controller, Get, Post, Put, Delete, Patch, Param, Query, Body,
} from '@nestjs/common';
import { ProviderManagementService, CreateProviderDto, UpdateProviderDto } from './provider-management.service';

@Controller('communications-cloud/providers')
export class ProviderManagementController {
  constructor(private readonly providerService: ProviderManagementService) {}

  @Get()
  async getAll(@Query('channel') channel?: string) {
    return this.providerService.getProviders(channel);
  }

  @Get('health')
  async getHealth() {
    return this.providerService.getProviderHealth();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.providerService.getProvider(id);
  }

  @Post()
  async create(@Body() data: CreateProviderDto) {
    return this.providerService.createProvider(data);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() data: UpdateProviderDto) {
    return this.providerService.updateProvider(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.providerService.deleteProvider(id);
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string) {
    return this.providerService.testProviderConnection(id);
  }

  @Patch(':id/toggle')
  async toggle(@Param('id') id: string, @Body() data: { isActive: boolean }) {
    return this.providerService.toggleProvider(id, data.isActive);
  }
}
