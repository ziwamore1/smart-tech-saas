import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClassService } from './class.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('class')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassController {
  constructor(private readonly service: ClassService) {}

  @Post()
  @Roles('Director')
  create(
    @Body()
    body: {
      name: string;
      levelTypeId: string;
      order: number;
      capacity?: number;
      gradingSystemId?: string;
    },
    @Req() req: any,
  ) {
    return this.service.create(
      body.name,
      body.levelTypeId,
      body.order,
      req.user.schoolId,
      body.capacity,
      body.gradingSystemId,
    );
  }

  @Get()
  @Roles('Director', 'Teacher', 'Class Teacher')
  findAll(@Req() req: any) {
    return this.service.findAll(req.user);
  }

  @Patch(':id')
  @Roles('Director')
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; capacity?: number | null; order?: number; gradingSystemId?: string | null },
    @Req() req: any,
  ) {
    return this.service.update(id, body, req.user.schoolId);
  }

  @Patch(':id/class-teacher')
  @Roles('Director')
  setClassTeacher(
    @Param('id') id: string,
    @Body() body: { teacherId: string | null },
    @Req() req: any,
  ) {
    return this.service.setClassTeacher(id, body.teacherId, req.user.schoolId);
  }

  @Delete(':id')
  @Roles('Director')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.service.delete(id, req.user.schoolId);
  }

  @Get('by-level')
  @Roles('Director', 'Teacher', 'Class Teacher')
  findByLevel(@Query('levelTypeId') levelTypeId: string, @Req() req: any) {
    return this.service.findByLevel(levelTypeId, req.user);
  }
}
