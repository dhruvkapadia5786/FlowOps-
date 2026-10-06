import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { OrgRole } from '@prisma/client';
import type { CachedMembership } from './cache.module';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private connected = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    await this.quit();
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.connected && this.redis.status === 'ready') {
      return true;
    }
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      this.connected = true;
      return true;
    } catch (err) {
      this.logger.warn(
        `Redis cache unavailable: ${err instanceof Error ? err.message : err}`,
      );
      return false;
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!(await this.ensureConnected())) {
      return null;
    }
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    if (!(await this.ensureConnected())) {
      return;
    }
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      /* best-effort cache */
    }
  }

  async del(key: string): Promise<void> {
    if (!(await this.ensureConnected())) {
      return;
    }
    try {
      await this.redis.del(key);
    } catch {
      /* ignore */
    }
  }

  membershipKey(orgId: string, userId: string) {
    return `flowops:membership:${orgId}:${userId}`;
  }

  async getMembership(
    orgId: string,
    userId: string,
  ): Promise<CachedMembership | null> {
    return this.getJson<CachedMembership>(this.membershipKey(orgId, userId));
  }

  async setMembership(
    orgId: string,
    userId: string,
    role: OrgRole,
    ttlSeconds = 30,
  ): Promise<void> {
    await this.setJson(this.membershipKey(orgId, userId), { role }, ttlSeconds);
  }

  async invalidateMembership(orgId: string, userId: string): Promise<void> {
    await this.del(this.membershipKey(orgId, userId));
  }

  environmentsKey(orgId: string) {
    return `flowops:environments:${orgId}`;
  }

  async quit(): Promise<void> {
    try {
      if (this.redis.status !== 'end') {
        await this.redis.quit();
      }
    } catch {
      this.redis.disconnect();
    }
  }
}
