import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DirectorService } from './director.service';

@Controller('director')
export class DirectorController {
  constructor(private directorService: DirectorService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('dashboard')
  async getDashboard(@Req() req) {
    return this.directorService.getDashboard(req.user);
  }
}
