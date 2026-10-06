import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisCacheService } from '../../common/cache/redis-cache.service';
import { AuditService } from '../audit/audit.service';
import { UpdateEnvironmentDto } from './dto/environments.dto';

const ENV_CACHE_TTL_SEC = 60;

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cache: RedisCacheService,
  ) {}

  async list(orgId: string) {
    const key = this.cache.environmentsKey(orgId);
    const cached = await this.cache.getJson<unknown[]>(key);
    if (cached) {
      return cached;
    }

    const rows = await this.prisma.environment.findMany({
      where: { organizationId: orgId },
      orderBy: { sortOrder: 'asc' },
      include: { healthCheckConfig: true },
    });
    await this.cache.setJson(key, rows, ENV_CACHE_TTL_SEC);
    return rows;
  }

  async get(orgId: string, id: string) {
    const env = await this.prisma.environment.findFirst({
      where: { id, organizationId: orgId },
      include: { healthCheckConfig: true },
    });
    if (!env) {
      throw new NotFoundException('Environment not found');
    }
    return env;
  }

  async update(
    orgId: string,
    actorId: string,
    id: string,
    dto: UpdateEnvironmentDto,
  ) {
    await this.get(orgId, id);
    const env = await this.prisma.environment.update({
      where: { id },
      data: {
        name: dto.name,
        requiresApproval: dto.requiresApproval,
        sortOrder: dto.sortOrder,
        healthCheckConfig: {
          upsert: {
            create: {
              endpointPath: dto.healthEndpointPath ?? '/health',
              timeoutMs: dto.healthTimeoutMs ?? 5000,
            },
            update: {
              ...(dto.healthEndpointPath
                ? { endpointPath: dto.healthEndpointPath }
                : {}),
              ...(dto.healthTimeoutMs
                ? { timeoutMs: dto.healthTimeoutMs }
                : {}),
            },
          },
        },
      },
      include: { healthCheckConfig: true },
    });

    await this.cache.del(this.cache.environmentsKey(orgId));

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'environment.update',
      entityType: 'environment',
      entityId: env.id,
    });
    return env;
  }

  /** Ensure Dev/QA/UAT/Prod exist for an org (idempotent). */
  async ensureDefaults(orgId: string) {
    const defaults = [
      {
        name: 'Development',
        slug: 'dev',
        requiresApproval: false,
        sortOrder: 1,
      },
      { name: 'QA', slug: 'qa', requiresApproval: false, sortOrder: 2 },
      { name: 'UAT', slug: 'uat', requiresApproval: false, sortOrder: 3 },
      {
        name: 'Production',
        slug: 'prod',
        requiresApproval: true,
        sortOrder: 4,
      },
    ];

    for (const env of defaults) {
      await this.prisma.environment.upsert({
        where: {
          organizationId_slug: {
            organizationId: orgId,
            slug: env.slug,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          ...env,
          healthCheckConfig: {
            create: {},
          },
        },
      });
    }
    await this.cache.del(this.cache.environmentsKey(orgId));
  }
}
