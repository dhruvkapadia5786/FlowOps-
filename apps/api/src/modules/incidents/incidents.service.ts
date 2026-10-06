import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IncidentSeverity,
  IncidentStatus,
  OrgRole,
  Prisma,
} from '@prisma/client';
import { paginateMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateIncidentDto,
  INCIDENT_TRANSITIONS,
  ListIncidentsQuery,
  UpdateIncidentDto,
} from './dto/incidents.dto';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(orgId: string, query: ListIncidentsQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.IncidentWhereInput = {
      organizationId: orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.environmentId ? { environmentId: query.environmentId } : {}),
      ...(query.deploymentId ? { deploymentId: query.deploymentId } : {}),
      ...(query.source ? { source: query.source } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          service: { select: { id: true, name: true, slug: true } },
          environment: { select: { id: true, name: true, slug: true } },
          deployment: {
            select: { id: true, version: true, status: true },
          },
          assignee: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
    ]);

    return { data, meta: paginateMeta(total, page, pageSize) };
  }

  async get(orgId: string, id: string) {
    const incident = await this.prisma.incident.findFirst({
      where: { id, organizationId: orgId },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        environment: { select: { id: true, name: true, slug: true } },
        deployment: {
          select: {
            id: true,
            version: true,
            status: true,
            failureReason: true,
            commitSha: true,
          },
        },
        assignee: {
          select: { id: true, fullName: true, email: true },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  async create(orgId: string, actorId: string, dto: CreateIncidentDto) {
    await this.assertServiceEnv(orgId, dto.serviceId, dto.environmentId);
    if (dto.deploymentId) {
      const existing = await this.prisma.incident.findUnique({
        where: { deploymentId: dto.deploymentId },
      });
      if (existing) {
        return existing;
      }
    }

    const incident = await this.prisma.incident.create({
      data: {
        organizationId: orgId,
        serviceId: dto.serviceId,
        environmentId: dto.environmentId,
        deploymentId: dto.deploymentId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        assigneeId: dto.assigneeId,
        source: 'manual',
        events: {
          create: {
            fromStatus: null,
            toStatus: IncidentStatus.open,
            message: 'Incident opened',
            actorId,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'incident.created',
      entityType: 'incident',
      entityId: incident.id,
      metadata: {
        severity: incident.severity,
        source: 'manual',
        deploymentId: dto.deploymentId ?? null,
      },
    });

    await this.emitCreated(incident);

    return this.get(orgId, incident.id);
  }

  async update(
    orgId: string,
    actorId: string,
    id: string,
    dto: UpdateIncidentDto,
  ) {
    const current = await this.get(orgId, id);

    if (dto.status && dto.status !== current.status) {
      const allowed = INCIDENT_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Illegal incident transition ${current.status} → ${dto.status}`,
        );
      }
    }

    const nextStatus = dto.status ?? current.status;
    let resolvedAt = current.resolvedAt;
    if (nextStatus === IncidentStatus.resolved) {
      resolvedAt = current.resolvedAt ?? new Date();
    } else if (dto.status) {
      resolvedAt = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.update({
        where: { id },
        data: {
          status: dto.status,
          severity: dto.severity,
          description: dto.description,
          assigneeId: dto.assigneeId === undefined ? undefined : dto.assigneeId,
          resolvedAt,
        },
      });

      if (dto.status && dto.status !== current.status) {
        await tx.incidentEvent.create({
          data: {
            incidentId: id,
            fromStatus: current.status,
            toStatus: dto.status,
            message: dto.note ?? `Status changed to ${dto.status}`,
            actorId,
          },
        });
      } else if (dto.note) {
        await tx.incidentEvent.create({
          data: {
            incidentId: id,
            fromStatus: current.status,
            toStatus: current.status,
            message: dto.note,
            actorId,
          },
        });
      }

      return incident;
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'incident.updated',
      entityType: 'incident',
      entityId: id,
      metadata: {
        status: updated.status,
        severity: updated.severity,
      },
    });

    this.realtime.emitToOrg(orgId, REALTIME_EVENTS.INCIDENT_UPDATED, {
      id,
      status: updated.status,
      severity: updated.severity,
    });

    return this.get(orgId, id);
  }

  async resolve(orgId: string, actorId: string, id: string, note?: string) {
    return this.update(orgId, actorId, id, {
      status: IncidentStatus.resolved,
      note: note ?? 'Incident resolved',
    });
  }

  /**
   * Idempotent auto-create for deployment failures (one incident per deployment).
   */
  async openForDeploymentFailure(input: {
    organizationId: string;
    deploymentId: string;
    serviceId: string;
    environmentId: string;
    serviceSlug: string;
    environmentSlug: string;
    version: string;
    failureReason?: string | null;
    source?: string;
    severity?: IncidentSeverity;
  }) {
    const existing = await this.prisma.incident.findUnique({
      where: { deploymentId: input.deploymentId },
    });
    if (existing) {
      return existing;
    }

    const severity =
      input.severity ??
      (input.environmentSlug === 'prod'
        ? IncidentSeverity.sev1
        : IncidentSeverity.sev2);

    const title = `Deploy failed: ${input.serviceSlug}@${input.version} → ${input.environmentSlug}`;
    const incident = await this.prisma.incident.create({
      data: {
        organizationId: input.organizationId,
        deploymentId: input.deploymentId,
        serviceId: input.serviceId,
        environmentId: input.environmentId,
        title,
        description: input.failureReason ?? 'Deployment failed during pipeline',
        severity,
        source: input.source ?? 'deployment_failure',
        events: {
          create: {
            fromStatus: null,
            toStatus: IncidentStatus.open,
            message: 'Auto-opened from deployment failure',
          },
        },
      },
    });

    await this.audit.log({
      organizationId: input.organizationId,
      actorId: null,
      action: 'incident.auto_created',
      entityType: 'incident',
      entityId: incident.id,
      metadata: {
        deploymentId: input.deploymentId,
        source: incident.source,
        severity,
      },
    });

    this.logger.warn(
      `Auto-incident ${incident.id} for deploy ${input.deploymentId}`,
    );
    await this.emitCreated(incident);
    return incident;
  }

  /**
   * Auto-create (or enrich) incident from health monitoring signals.
   * Dedupes open health incidents per service+env within recent window.
   */
  async openForHealthSignal(input: {
    organizationId: string;
    serviceId: string;
    environmentId: string;
    serviceSlug: string;
    environmentSlug: string;
    reason: string;
    source: string;
    severity?: IncidentSeverity;
    deploymentId?: string;
  }) {
    if (input.deploymentId) {
      return this.openForDeploymentFailure({
        organizationId: input.organizationId,
        deploymentId: input.deploymentId,
        serviceId: input.serviceId,
        environmentId: input.environmentId,
        serviceSlug: input.serviceSlug,
        environmentSlug: input.environmentSlug,
        version: 'health-check',
        failureReason: input.reason,
        source: input.source,
        severity: input.severity,
      });
    }

    const recent = await this.prisma.incident.findFirst({
      where: {
        organizationId: input.organizationId,
        serviceId: input.serviceId,
        environmentId: input.environmentId,
        source: { startsWith: 'health_' },
        status: {
          in: [
            IncidentStatus.open,
            IncidentStatus.investigating,
            IncidentStatus.mitigated,
          ],
        },
        openedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
      orderBy: { openedAt: 'desc' },
    });
    if (recent) {
      await this.prisma.incidentEvent.create({
        data: {
          incidentId: recent.id,
          fromStatus: recent.status,
          toStatus: recent.status,
          message: `Health signal: ${input.reason}`,
        },
      });
      return recent;
    }

    const severity =
      input.severity ??
      (input.environmentSlug === 'prod'
        ? IncidentSeverity.sev2
        : IncidentSeverity.sev3);

    const incident = await this.prisma.incident.create({
      data: {
        organizationId: input.organizationId,
        serviceId: input.serviceId,
        environmentId: input.environmentId,
        title: `Health alert: ${input.serviceSlug} @ ${input.environmentSlug}`,
        description: input.reason,
        severity,
        source: input.source,
        events: {
          create: {
            fromStatus: null,
            toStatus: IncidentStatus.open,
            message: input.reason,
          },
        },
      },
    });

    await this.audit.log({
      organizationId: input.organizationId,
      actorId: null,
      action: 'incident.auto_created',
      entityType: 'incident',
      entityId: incident.id,
      metadata: { source: input.source, reason: input.reason },
    });

    await this.emitCreated(incident);
    return incident;
  }

  private async emitCreated(incident: {
    id: string;
    organizationId: string;
    title: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    source: string;
    deploymentId?: string | null;
  }) {
    this.realtime.emitToOrg(
      incident.organizationId,
      REALTIME_EVENTS.INCIDENT_CREATED,
      {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        status: incident.status,
        source: incident.source,
        deploymentId: incident.deploymentId ?? null,
      },
    );
    await this.notifications.notifyOrgRoles(
      incident.organizationId,
      [OrgRole.admin, OrgRole.devops, OrgRole.release_manager],
      'incident.opened',
      {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        source: incident.source,
      },
    );
  }

  private async assertServiceEnv(
    orgId: string,
    serviceId: string,
    environmentId: string,
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, organizationId: orgId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, organizationId: orgId },
    });
    if (!env) {
      throw new NotFoundException('Environment not found');
    }
  }
}
