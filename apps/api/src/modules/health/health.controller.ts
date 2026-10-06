import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { OrgRole } from '@prisma/client';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import {
  CurrentUser,
  Public,
  Roles,
} from '../../common/decorators/auth.decorators';
import type { AuthUser } from '../../common/decorators/auth.decorators';
import { OrgScoped } from '../../common/decorators/org-scoped.decorator';
import { PrismaService } from '../../database/prisma.service';
import {
  RunHealthChecksDto,
  UpsertHealthConfigDto,
} from './dto/health-monitor.dto';
import { HealthMonitorService } from './health-monitor.service';

@SkipThrottle()
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
    const url =
      this.config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
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

@OrgScoped()
@Controller('health-configs')
export class HealthConfigsController {
  constructor(private readonly monitor: HealthMonitorService) {}

  @Get(':environmentId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
  ) {
    return this.monitor.getConfig(user.orgId!, environmentId);
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Put(':environmentId')
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Body() dto: UpsertHealthConfigDto,
  ) {
    return this.monitor.upsertConfig(user.orgId!, environmentId, dto);
  }
}

@OrgScoped()
@Controller('service-health')
export class ServiceHealthController {
  constructor(private readonly monitor: HealthMonitorService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.monitor.listSnapshots(user.orgId!);
  }

  @Get(':serviceId/:environmentId')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
  ) {
    return this.monitor.getSnapshot(user.orgId!, serviceId, environmentId);
  }

  @Roles(OrgRole.admin, OrgRole.devops)
  @Post('run')
  run(@CurrentUser() user: AuthUser, @Body() dto: RunHealthChecksDto) {
    return this.monitor.runChecks(user.orgId!, dto);
  }
}
