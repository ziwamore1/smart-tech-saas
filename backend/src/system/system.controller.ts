import { Controller, Get } from '@nestjs/common';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller('system')
export class SystemController {
  @Get('logo')
  getSystemLogo() {
    const logoPath = join(__dirname, '../../uploads/logo.png');
    const systemLogoPath = join(__dirname, '../../uploads/system/logo.png');
    const smartTechLogo = join(__dirname, '../../smart_tech_logo/smart_tech_logo.png');

    let url = '/uploads/logo.png';
    if (existsSync(logoPath)) {
      url = '/uploads/logo.png';
    } else if (existsSync(systemLogoPath)) {
      url = '/uploads/system/logo.png';
    } else if (existsSync(smartTechLogo)) {
      url = '/smart_tech_logo/smart_tech_logo.png';
    }
    return { url, name: 'SmartTech' };
  }
}
