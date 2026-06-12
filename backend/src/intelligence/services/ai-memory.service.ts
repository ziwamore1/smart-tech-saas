import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT_TOKEN } from '../../queues/queue-definitions';

interface ConversationMemory {
  subject?: string;
  topic?: string;
  role?: string;
  className?: string;
  grade?: string;
  recentMessages: { role: string; content: string }[];
  performanceSnapshot?: {
    average?: number | null;
    weakAreas?: string[];
  };
  lastUpdated: number;
}

const TTL_SECONDS = 86400;
const KEY_PREFIX = 'ai:memory:';
const MAX_RECENT = 10;

@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name);
  private readonly localCache = new Map<string, ConversationMemory>();
  private redisAvailable = true;

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis | null,
  ) {
    if (redis) {
      redis.on('error', () => { this.redisAvailable = false; });
      redis.on('ready', () => { this.redisAvailable = true; });
      redis.on('connect', () => { this.redisAvailable = true; });
    } else {
      this.redisAvailable = false;
    }
  }

  private key(studentId: string, sessionId?: string): string {
    return `${KEY_PREFIX}${studentId}${sessionId ? `:${sessionId}` : ''}`;
  }

  async getOrCreate(studentId: string, sessionId?: string): Promise<ConversationMemory> {
    if (!this.redisAvailable) {
      const cached = this.localCache.get(this.key(studentId, sessionId));
      return cached ? { ...cached } : this.defaultMemory();
    }

    try {
      const raw = await this.redis!.get(this.key(studentId, sessionId));
      if (raw) {
        const parsed = JSON.parse(raw) as ConversationMemory;
        this.localCache.set(this.key(studentId, sessionId), parsed);
        return parsed;
      }
    } catch {
      this.redisAvailable = false;
      const cached = this.localCache.get(this.key(studentId, sessionId));
      if (cached) return { ...cached };
    }
    return this.defaultMemory();
  }

  async update(
    studentId: string,
    partial: Partial<ConversationMemory>,
    sessionId?: string,
  ): Promise<ConversationMemory> {
    const mem = await this.getOrCreate(studentId, sessionId);
    const updated: ConversationMemory = {
      ...mem,
      ...partial,
      lastUpdated: Date.now(),
    };

    if (partial.recentMessages) {
      updated.recentMessages = [
        ...mem.recentMessages,
        ...partial.recentMessages,
      ].slice(-MAX_RECENT);
    }

    this.localCache.set(this.key(studentId, sessionId), { ...updated });

    if (this.redisAvailable) {
      try {
        await this.redis!.setex(this.key(studentId, sessionId), TTL_SECONDS, JSON.stringify(updated));
      } catch {
        this.redisAvailable = false;
      }
    }

    return updated;
  }

  async pushMessage(
    studentId: string,
    role: string,
    content: string,
    sessionId?: string,
  ): Promise<ConversationMemory> {
    return this.update(studentId, {
      recentMessages: [{ role, content }],
    }, sessionId);
  }

  async clear(studentId: string, sessionId?: string): Promise<void> {
    this.localCache.delete(this.key(studentId, sessionId));

    if (this.redisAvailable) {
      try {
        await this.redis!.del(this.key(studentId, sessionId));
      } catch {
        this.redisAvailable = false;
      }
    }
  }

  private defaultMemory(): ConversationMemory {
    return {
      recentMessages: [],
      lastUpdated: Date.now(),
    };
  }
}
