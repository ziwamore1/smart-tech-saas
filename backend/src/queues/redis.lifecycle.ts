import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from './queue-definitions';

@Injectable()
export class RedisLifecycle implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis && this.redis.status !== 'end') await this.redis.quit().catch(() => this.redis?.disconnect());
  }
}
