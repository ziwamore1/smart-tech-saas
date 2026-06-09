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

  constructor(
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
  ) {}

  private key(studentId: string, sessionId?: string): string {
    return `${KEY_PREFIX}${studentId}${sessionId ? `:${sessionId}` : ''}`;
  }

  async getOrCreate(studentId: string, sessionId?: string): Promise<ConversationMemory> {
    const raw = await this.redis.get(this.key(studentId, sessionId));
    if (raw) {
      try {
        return JSON.parse(raw) as ConversationMemory;
      } catch {
        return this.defaultMemory();
      }
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

    await this.redis.setex(this.key(studentId, sessionId), TTL_SECONDS, JSON.stringify(updated));
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
    await this.redis.del(this.key(studentId, sessionId));
  }

  private defaultMemory(): ConversationMemory {
    return {
      recentMessages: [],
      lastUpdated: Date.now(),
    };
  }
}
