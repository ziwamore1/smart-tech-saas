import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoutingRulesService } from './routing-rules.service';

@Controller('communications-cloud/routing')
@UseGuards(JwtAuthGuard)
export class RoutingRulesController {
  constructor(private readonly routingRulesService: RoutingRulesService) {}

  @Get('rules')
  async getRules(@Query('channel') channel?: string) {
    return this.routingRulesService.getRules(channel);
  }

  @Get('rules/:id')
  async getRule(@Param('id') id: string) {
    return this.routingRulesService.getRule(id);
  }

  @Post('rules')
  async createRule(@Body() dto: any) {
    return this.routingRulesService.createRule(dto);
  }

  @Put('rules/:id')
  async updateRule(@Param('id') id: string, @Body() dto: any) {
    return this.routingRulesService.updateRule(id, dto);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    await this.routingRulesService.deleteRule(id);
    return { success: true };
  }

  @Post('rules/:id/toggle')
  async toggleRule(@Param('id') id: string, @Body() dto: { isActive: boolean }) {
    return this.routingRulesService.toggleRule(id, dto.isActive);
  }
}
