import { Controller, Get, Head, Inject } from '@nestjs/common';
import { HealthService } from './health.service';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../queues/queue-definitions';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    return this.healthService.check();
  }

  @Get('redis')
  async checkRedis() {
    try {
      await this.redis.ping();
      return { status: 'ok', redis: 'connected' };
    } catch {
      return { status: 'error', redis: 'disconnected' };
    }
  }

  @Get('detailed')
  async checkDetailed() {
    return this.healthService.checkDetailed();
  }

  @Head()
  async head() {
    const health = await this.healthService.check();
    if (health.status === 'unhealthy') {
      throw new Error('Service unhealthy');
    }
    return { status: 'ok' };
  }
}
