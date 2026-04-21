import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ConstraintsService } from './constraints.service';

@Controller('constraints')
export class ConstraintsController {
  constructor(private readonly service: ConstraintsService) {}

  @Get(':schoolId')
  getConstraints(@Param('schoolId') schoolId: string) {
    return this.service.getConstraints(schoolId);
  }

  @Post(':schoolId')
  saveConstraints(@Param('schoolId') schoolId: string, @Body() data: any) {
    return this.service.saveConstraints(schoolId, data);
  }
}
