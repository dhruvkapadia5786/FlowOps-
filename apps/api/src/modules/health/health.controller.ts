import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/auth.decorators';
import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.pingRedis(),
    ]);
  }

  private async pingRedis(): Promise<HealthIndicatorResult> {
    const url = this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return {
        redis: {
          status: pong === 'PONG' ? 'up' : 'down',
        },
      };
    } catch (error) {
      try {
        client.disconnect();
      } catch {
        /* ignore */
      }
      return {
        redis: {
          status: 'down',
          message: error instanceof Error ? error.message : 'redis unavailable',
        },
      };
    }
  }
}
