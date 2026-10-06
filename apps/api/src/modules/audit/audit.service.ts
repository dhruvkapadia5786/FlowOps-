import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginateMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { ListAuditLogsQuery } from './dto/audit.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    organizationId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
  }) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async list(orgId: string, query: ListAuditLogsQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);

    const environmentClause = await this.environmentFilter(
      orgId,
      query.environmentId,
    );

    const where: Prisma.AuditLogWhereInput = {
      organizationId: orgId,
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action
        ? { action: { contains: query.action, mode: 'insensitive' } }
        : {}),
      ...(query.entityType
        ? { entityType: { equals: query.entityType, mode: 'insensitive' } }
        : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(environmentClause ? { AND: [environmentClause] } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return { data, meta: paginateMeta(total, page, pageSize) };
  }

  async facets(orgId: string) {
    const [actions, entityTypes, actors] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { organizationId: orgId },
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
        take: 200,
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: orgId },
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
        take: 100,
      }),
      this.prisma.auditLog.findMany({
        where: { organizationId: orgId, actorId: { not: null } },
        distinct: ['actorId'],
        select: {
          actorId: true,
          actor: { select: { id: true, fullName: true, email: true } },
        },
        take: 100,
      }),
    ]);

    return {
      actions: actions.map((a) => a.action),
      entityTypes: entityTypes.map((e) => e.entityType),
      actors: actors
        .map((a) => a.actor)
        .filter((a): a is NonNullable<typeof a> => !!a),
    };
  }

  private async environmentFilter(
    orgId: string,
    environmentId?: string,
  ): Promise<Prisma.AuditLogWhereInput | null> {
    if (!environmentId) {
      return null;
    }

    const [deployments, incidents] = await Promise.all([
      this.prisma.deployment.findMany({
        where: { organizationId: orgId, environmentId },
        select: { id: true },
        take: 500,
      }),
      this.prisma.incident.findMany({
        where: { organizationId: orgId, environmentId },
        select: { id: true },
        take: 500,
      }),
    ]);

    const deploymentIds = deployments.map((d) => d.id);
    const incidentIds = incidents.map((i) => i.id);

    return {
      OR: [
        { entityType: 'environment', entityId: environmentId },
        ...(deploymentIds.length
          ? [{ entityType: 'deployment', entityId: { in: deploymentIds } }]
          : []),
        ...(incidentIds.length
          ? [{ entityType: 'incident', entityId: { in: incidentIds } }]
          : []),
        {
          metadata: {
            path: ['environmentId'],
            equals: environmentId,
          },
        },
      ],
    };
  }
}
