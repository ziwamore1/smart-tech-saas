import { Controller, Post, Get, Patch, Delete, Body, Param, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('subject')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubjectController {
  constructor(private readonly service: SubjectService) {}

  @Post()
  @Roles('Director')
  async create(@Body() body: { name: string; code?: string; category?: string; description?: string; credits?: string }, @Req() req: any) {
    try {
      console.log('Create subject:', body, 'User:', req.user?.id);
      return await this.service.create(body, req.user.schoolId);
    } catch (error) {
      console.error('Create subject error:', error);
      throw new HttpException(error.message || 'Failed to create subject', HttpStatus.BAD_REQUEST);
    }
  }

  @Get()
  @Roles('Director')
  async findAll(@Req() req: any) {
    return this.service.findAll(req.user.schoolId);
  }

  @Get(':id')
  @Roles('Director')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('Director')
  async update(@Param('id') id: string, @Body() body: { name?: string; code?: string; category?: string; description?: string; credits?: string }, @Req() req: any) {
    try {
      return await this.service.update(id, body, req.user.schoolId);
    } catch (error) {
      console.error('Update subject error:', error);
      throw new HttpException(error.message || 'Failed to update subject', HttpStatus.BAD_REQUEST);
    }
  }

  @Delete(':id')
  @Roles('Director')
  async delete(@Param('id') id: string, @Req() req: any) {
    try {
      return await this.service.delete(id, req.user.schoolId);
    } catch (error) {
      console.error('Delete subject error:', error);
      throw new HttpException(error.message || 'Failed to delete subject', HttpStatus.BAD_REQUEST);
    }
  }
}
