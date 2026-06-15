import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AcademicTemplatesService } from './academic-templates.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('super-admin/academic-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class AcademicTemplatesController {
  constructor(
    private readonly service: AcademicTemplatesService,
  ) {}

  @Get('categories')
  async getCategories() {
    return this.service.getCategories();
  }

  @Post('categories')
  async createCategory(@Body() data: {
    name: string; slug: string; description?: string; icon?: string;
    educationLevel?: string; sortOrder?: number;
  }) {
    return this.service.createCategory(data);
  }

  @Patch('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() data: any) {
    return this.service.updateCategory(id, data);
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.service.deleteCategory(id);
  }

  @Get()
  async getTemplates(
    @Query('categoryId') categoryId?: string,
    @Query('educationLevel') educationLevel?: string,
    @Query('type') type?: string,
  ) {
    return this.service.getTemplates({ categoryId, educationLevel, type });
  }

  @Get(':id')
  async getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id);
  }

  @Post()
  async createTemplate(@Body() data: any) {
    return this.service.createTemplate(data);
  }

  @Patch(':id')
  async updateTemplate(@Param('id') id: string, @Body() data: any) {
    return this.service.updateTemplate(id, data);
  }

  @Delete(':id')
  async deleteTemplate(@Param('id') id: string) {
    return this.service.deleteTemplate(id);
  }

  @Post(':id/duplicate')
  async duplicateTemplate(@Param('id') id: string) {
    return this.service.duplicateTemplate(id);
  }

  @Post(':id/publish-to-marketplace')
  async publishToMarketplace(@Param('id') id: string, @Body() data: {
    title?: string; description?: string; category?: string; tags?: string[]; featured?: boolean;
  }) {
    return this.service.publishToMarketplace(id, data);
  }

  @Post(':id/assign-to-schools')
  async assignToSchools(@Param('id') id: string, @Body() data: { schoolIds?: string[] }) {
    return this.service.assignToSchools(id, data?.schoolIds);
  }

  @Post('seed-defaults')
  async seedDefaults() {
    return this.service.seedDefaults();
  }

  @Post('seed-marketplace')
  async seedMarketplace() {
    return this.service.seedMarketplace();
  }

  @Get('stats/overview')
  async getOverview() {
    return this.service.getOverview();
  }

  @Post('ai-remarks/generate')
  async generateAiRemarks(@Body() data: {
    type: 'teacher' | 'class_teacher' | 'head_teacher' | 'promotion';
    studentName?: string;
    academicPerformance?: string;
    attendance?: string;
    discipline?: string;
    assessmentResults?: string;
  }) {
    return this.service.generateAiRemarks(data);
  }
}
