import { Controller, Get } from '@nestjs/common';

@Controller('app-info')
export class AppInfoController {
  @Get('version')
  async getLatestVersion() {
    return {
      latestVersion: '1.0.0',
      minVersion: '1.0.0',
      apkUrl: null,
      releaseNotes: 'Initial release',
      forceUpdate: false,
      updatedAt: new Date().toISOString(),
    };
  }
}
