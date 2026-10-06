import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  ApprovalStatus,
  DeploymentStatus,
  OrgRole,
  Prisma,
} from '@prisma/client';
import {
  paginateMeta,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  canTransition,
  DEPLOYMENTS_QUEUE,
  SIMULATE_PIPELINE_JOB,
} from './deployment-state.machine';
import {
  CreateDeploymentDto,
  ListDeploymentsQuery,
} from './dto/deployments.dto';

@Injectable()
export class DeploymentsService {
  private readonly logger = new Logger(DeploymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @InjectQueue(DEPLOYMENTS_QUEUE) private readonly queue: Queue,
  ) {}

  async list(orgId: string, query: ListDeploymentsQuery) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.DeploymentWhereInput = {
      organizationId: orgId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      ...(query.environmentId ? { environmentId: query.environmentId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.deployment.count({ where }),
      this.prisma.deployment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          service: { select: { id: true, name: true, slug: true } },
          environment: {
            select: { id: true, name: true, slug: true, requiresApproval: true },
          },
          triggeredBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return { data, meta: paginateMeta(total, page, pageSize) };
  }

  async get(orgId: string, id: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        environment: {
          select: { id: true, name: true, slug: true, requiresApproval: true },
        },
        triggeredBy: { select: { id: true, fullName: true, email: true } },
        approval: true,
        events: { orderBy: { createdAt: 'asc' }, take: 50 },
      },
    });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }
    return deployment;
  }

  async listEvents(orgId: string, id: string) {
    await this.get(orgId, id);
    return this.prisma.deploymentEvent.findMany({
      where: { deploymentId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    orgId: string,
    actorId: string,
    role: OrgRole | undefined,
    dto: CreateDeploymentDto,
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, organizationId: orgId, isActive: true },
    });
    if (!service) {
      throw new NotFoundException('Service not found or inactive');
    }

    const environment = await this.prisma.environment.findFirst({
      where: { id: dto.environmentId, organizationId: orgId },
    });
    if (!environment) {
      throw new NotFoundException('Environment not found');
    }

    if (
      role === OrgRole.developer &&
      (environment.requiresApproval || environment.slug === 'prod')
    ) {
      throw new ForbiddenException(
        'Developers cannot create production deployments',
      );
    }

    if (role === OrgRole.viewer) {
      throw new ForbiddenException('Viewers cannot create deployments');
    }

    const deployment = await this.prisma.deployment.create({
      data: {
        organizationId: orgId,
        serviceId: service.id,
        environmentId: environment.id,
        triggeredById: actorId,
        version: dto.version,
        commitSha: dto.commitSha,
        status: DeploymentStatus.queued,
        startedAt: new Date(),
        events: {
          create: {
            fromStatus: null,
            toStatus: DeploymentStatus.queued,
            message: 'Deployment queued',
          },
        },
      },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        environment: {
          select: { id: true, name: true, slug: true, requiresApproval: true },
        },
        triggeredBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'deployment.create',
      entityType: 'deployment',
      entityId: deployment.id,
      metadata: {
        version: deployment.version,
        serviceId: service.id,
        environmentId: environment.id,
      },
    });

    await this.queue.add(
      SIMULATE_PIPELINE_JOB,
      { deploymentId: deployment.id },
      {
        jobId: `pipeline-${deployment.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(`Enqueued pipeline for deployment ${deployment.id}`);
    return deployment;
  }

  /**
   * Atomically transition deployment status with event + audit.
   * Returns null if deployment missing; throws on illegal transition.
   */
  async transition(
    deploymentId: string,
    toStatus: DeploymentStatus,
    message?: string,
    failureReason?: string,
  ) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { environment: true },
    });
    if (!deployment) {
      return null;
    }

    if (!canTransition(deployment.status, toStatus)) {
      throw new BadRequestException(
        `Illegal transition ${deployment.status} → ${toStatus}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.deployment.update({
        where: { id: deploymentId },
        data: {
          status: toStatus,
          failureReason: failureReason ?? undefined,
          finishedAt:
            toStatus === DeploymentStatus.success ||
            toStatus === DeploymentStatus.failed ||
            toStatus === DeploymentStatus.rolled_back
              ? new Date()
              : undefined,
        },
      });

      await tx.deploymentEvent.create({
        data: {
          deploymentId,
          fromStatus: deployment.status,
          toStatus,
          message: message ?? `Status changed to ${toStatus}`,
        },
      });

      if (toStatus === DeploymentStatus.waiting_for_approval) {
        const ttlHours = Number(process.env.APPROVAL_TTL_HOURS ?? 24);
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
        await tx.approval.upsert({
          where: { deploymentId },
          update: {
            status: ApprovalStatus.pending,
            expiresAt,
            comment: null,
            decidedAt: null,
            decidedById: null,
          },
          create: {
            deploymentId,
            status: ApprovalStatus.pending,
            expiresAt,
          },
        });
        await tx.auditLog.create({
          data: {
            organizationId: deployment.organizationId,
            actorId: null,
            action: 'approval.requested',
            entityType: 'deployment',
            entityId: deploymentId,
            metadata: { expiresAt: expiresAt.toISOString() },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: deployment.organizationId,
          actorId: null,
          action: 'deployment.status_changed',
          entityType: 'deployment',
          entityId: deploymentId,
          metadata: {
            from: deployment.status,
            to: toStatus,
            message: message ?? null,
          },
        },
      });

      return next;
    });

    return updated;
  }
}
