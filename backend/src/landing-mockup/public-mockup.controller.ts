import { Controller, Get } from '@nestjs/common';
import { LandingMockupService } from './landing-mockup.service';

@Controller('public/landing-mockups')
export class PublicMockupController {
  constructor(private readonly service: LandingMockupService) {}

  @Get()
  async getMockups() {
    return this.service.getPublicMockups();
  }
}
