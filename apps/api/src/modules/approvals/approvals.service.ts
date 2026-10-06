import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApprovalStatus, DeploymentStatus, Prisma } from '@prisma/client';
import { paginateMeta } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeploymentsService } from '../deployments/deployments.service';
import {
  CONTINUE_PIPELINE_JOB,
  DEPLOYMENTS_QUEUE,
} from '../deployments/deployment-state.machine';
import { NotificationsService } from '../notifications/notifications.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import {
  ApprovalDecision,
  DecideApprovalDto,
  ListApprovalsQuery,
} from './dto/approvals.dto';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);
  /** In-process throttle so list/get do not sweep expiries on every request. */
  private readonly lastExpireSweep = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly deployments: DeploymentsService,
    @InjectQueue(DEPLOYMENTS_QUEUE) private readonly queue: Queue,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(orgId: string, query: ListApprovalsQuery) {
    await this.expireOverdueThrottled(orgId);

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);
    const where: Prisma.ApprovalWhereInput = {
      deployment: { organizationId: orgId },
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.approval.count({ where }),
      this.prisma.approval.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          decidedBy: {
            select: { id: true, fullName: true, email: true },
          },
          deployment: {
            select: {
              id: true,
              version: true,
              status: true,
              service: { select: { id: true, name: true, slug: true } },
              environment: {
                select: { id: true, name: true, slug: true },
              },
              triggeredBy: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
      }),
    ]);

    return { data, meta: paginateMeta(total, page, pageSize) };
  }

  async get(orgId: string, id: string) {
    await this.expireOverdueThrottled(orgId);

    const approval = await this.prisma.approval.findFirst({
      where: { id, deployment: { organizationId: orgId } },
      include: {
        decidedBy: {
          select: { id: true, fullName: true, email: true },
        },
        deployment: {
          include: {
            service: { select: { id: true, name: true, slug: true } },
            environment: {
              select: { id: true, name: true, slug: true },
            },
            triggeredBy: {
              select: { id: true, fullName: true, email: true },
            },
            events: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    const history = await this.prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { entityType: 'approval', entityId: approval.id },
          {
            entityType: 'deployment',
            entityId: approval.deploymentId,
            action: {
              in: [
                'deployment.status_changed',
                'approval.requested',
                'approval.decided',
                'approval.expired',
              ],
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
    });

    return { ...approval, history };
  }

  async decide(
    orgId: string,
    approvalId: string,
    actorId: string,
    dto: DecideApprovalDto,
  ) {
    await this.expireOverdue(orgId);

    const approval = await this.prisma.approval.findFirst({
      where: { id: approvalId, deployment: { organizationId: orgId } },
      include: { deployment: true },
    });
    if (!approval) {
      throw new NotFoundException('Approval not found');
    }
    if (approval.status !== ApprovalStatus.pending) {
      throw new BadRequestException(`Approval is already ${approval.status}`);
    }
    if (approval.expiresAt <= new Date()) {
      await this.expireOne(approval.id, approval.deploymentId, orgId);
      throw new BadRequestException('Approval has expired');
    }
    if (approval.deployment.status !== DeploymentStatus.waiting_for_approval) {
      throw new BadRequestException(
        `Deployment is ${approval.deployment.status}, not waiting_for_approval`,
      );
    }

    if (dto.decision === ApprovalDecision.approved) {
      await this.prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.approved,
          comment: dto.comment,
          decidedById: actorId,
          decidedAt: new Date(),
        },
      });

      await this.audit.log({
        organizationId: orgId,
        actorId,
        action: 'approval.decided',
        entityType: 'approval',
        entityId: approval.id,
        metadata: {
          decision: 'approved',
          comment: dto.comment ?? null,
          deploymentId: approval.deploymentId,
        },
      });

      await this.deployments.transition(
        approval.deploymentId,
        DeploymentStatus.deploying,
        dto.comment
          ? `Approved: ${dto.comment}`
          : 'Production deployment approved',
      );

      await this.queue.add(
        CONTINUE_PIPELINE_JOB,
        { deploymentId: approval.deploymentId },
        {
          jobId: `continue-${approval.deploymentId}-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 200,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );

      this.logger.log(`Approved ${approval.id}; continue pipeline enqueued`);
    } else {
      await this.prisma.approval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.rejected,
          comment: dto.comment,
          decidedById: actorId,
          decidedAt: new Date(),
        },
      });

      await this.audit.log({
        organizationId: orgId,
        actorId,
        action: 'approval.decided',
        entityType: 'approval',
        entityId: approval.id,
        metadata: {
          decision: 'rejected',
          comment: dto.comment ?? null,
          deploymentId: approval.deploymentId,
        },
      });

      await this.deployments.transition(
        approval.deploymentId,
        DeploymentStatus.failed,
        dto.comment
          ? `Rejected: ${dto.comment}`
          : 'Production deployment rejected',
        dto.comment ?? 'Approval rejected',
      );

      this.logger.log(`Rejected approval ${approval.id}`);
    }

    const decisionStatus =
      dto.decision === ApprovalDecision.approved
        ? ApprovalStatus.approved
        : ApprovalStatus.rejected;

    this.realtime.emitToOrg(orgId, REALTIME_EVENTS.APPROVAL_RESOLVED, {
      approvalId: approval.id,
      deploymentId: approval.deploymentId,
      status: decisionStatus,
      comment: dto.comment ?? null,
      decidedById: actorId,
    });

    const notifyIds = [approval.deployment.triggeredById].filter(
      (id): id is string => Boolean(id),
    );
    await this.notifications.notifyUsers({
      organizationId: orgId,
      userIds: notifyIds,
      type: 'approval.resolved',
      payload: {
        approvalId: approval.id,
        deploymentId: approval.deploymentId,
        status: decisionStatus,
        comment: dto.comment ?? null,
      },
    });

    return this.get(orgId, approval.id);
  }

  /** At most one expiry sweep per org every 30s (list/get hot path). */
  async expireOverdueThrottled(orgId: string) {
    const now = Date.now();
    const last = this.lastExpireSweep.get(orgId) ?? 0;
    if (now - last < 30_000) {
      return 0;
    }
    this.lastExpireSweep.set(orgId, now);
    return this.expireOverdue(orgId);
  }

  /** Expire overdue pending approvals for an org (idempotent). */
  async expireOverdue(orgId: string) {
    const overdue = await this.prisma.approval.findMany({
      where: {
        status: ApprovalStatus.pending,
        expiresAt: { lte: new Date() },
        deployment: { organizationId: orgId },
      },
      select: { id: true, deploymentId: true },
    });

    for (const row of overdue) {
      await this.expireOne(row.id, row.deploymentId, orgId);
    }
    return overdue.length;
  }

  private async expireOne(
    approvalId: string,
    deploymentId: string,
    orgId: string,
  ) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: { deployment: true },
    });
    if (!approval || approval.status !== ApprovalStatus.pending) {
      return;
    }

    await this.prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.expired,
        comment: approval.comment ?? 'Approval window expired',
        decidedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId: null,
      action: 'approval.expired',
      entityType: 'approval',
      entityId: approvalId,
      metadata: { deploymentId, expiresAt: approval.expiresAt.toISOString() },
    });

    if (approval.deployment.status === DeploymentStatus.waiting_for_approval) {
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.failed,
        'Approval expired',
        'Approval expired before a decision was made',
      );
    }
  }
}
