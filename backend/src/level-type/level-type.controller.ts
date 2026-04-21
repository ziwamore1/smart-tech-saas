import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { LevelTypeService } from './level-type.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('level-type')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LevelTypeController {
  constructor(private readonly service: LevelTypeService) {}

  @Post()
  @Roles('Director')
  create(@Body() body: { name: string }, @Req() req: any) {
    return this.service.create(body.name, req.user.schoolId);
  }

  @Get()
  @Roles('Director')
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.schoolId);
  }
}
