// src/term/term.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TermService } from './term.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('term')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TermController {
  constructor(private termService: TermService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.termService.findAllBySchool(req.user.schoolId);
  }

  @Post()
  @Roles('Director')
  create(@Body() body: any, @Req() req: any) {
    return this.termService.create(body, req.user.schoolId);
  }

  @Get('current')
  getCurrent(@Req() req: any) {
    return this.termService.getCurrent(req.user.schoolId);
  }

  @Get(':academicYearId')
  @Roles('Director')
  findAllByYear(@Param('academicYearId') academicYearId: string) {
    return this.termService.findAll(academicYearId);
  }

  @Patch(':id')
  @Roles('Director')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.termService.update(id, body, req.user.schoolId);
  }

  @Delete(':id')
  @Roles('Director')
  delete(@Param('id') id: string, @Req() req: any) {
    return this.termService.delete(id, req.user.schoolId);
  }

  @Patch(':id/set-current')
  @Roles('Director')
  setCurrent(@Param('id') id: string, @Req() req: any) {
    return this.termService.setCurrent(id, req.user.schoolId);
  }

  @Patch(':termId/finalize')
  @Roles('Director')
  finalizeResults(@Req() req, @Param('termId') termId: string) {
    return this.termService.finalizeResults(req.user.schoolId, termId);
  }

  @Patch(':termId/unfinalize')
  @Roles('Director')
  unfinalizeResults(@Req() req, @Param('termId') termId: string) {
    return this.termService.unfinalizeResults(req.user.schoolId, termId);
  }
}
