import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DeploymentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeploymentsService } from '../deployments/deployments.service';
import {
  DEPLOYMENTS_QUEUE,
  SIMULATE_ROLLBACK_JOB,
} from '../deployments/deployment-state.machine';

@Injectable()
export class RollbackService {
  private readonly logger = new Logger(RollbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly deployments: DeploymentsService,
    @InjectQueue(DEPLOYMENTS_QUEUE) private readonly queue: Queue,
  ) {}

  async get(orgId: string, deploymentId: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, organizationId: orgId },
      include: { rollback: true },
    });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }
    return deployment.rollback;
  }

  async start(orgId: string, deploymentId: string, actorId: string) {
    const deployment = await this.prisma.deployment.findFirst({
      where: { id: deploymentId, organizationId: orgId },
      include: { rollback: true, service: true, environment: true },
    });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }
    if (deployment.rollback) {
      throw new BadRequestException('Rollback already started for this deployment');
    }

    // Policy: allow from rollback_required, or promote failed → rollback_required
    if (deployment.status === DeploymentStatus.failed) {
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.rollback_required,
        'Rollback requested after failure',
      );
    } else if (deployment.status !== DeploymentStatus.rollback_required) {
      throw new BadRequestException(
        `Cannot rollback from status ${deployment.status}`,
      );
    }

    const previous = await this.prisma.deployment.findFirst({
      where: {
        organizationId: orgId,
        serviceId: deployment.serviceId,
        environmentId: deployment.environmentId,
        status: DeploymentStatus.success,
        id: { not: deploymentId },
        createdAt: { lt: deployment.createdAt },
      },
      orderBy: { createdAt: 'desc' },
    });

    const targetVersion = previous?.version ?? null;

    const rollback = await this.prisma.rollback.create({
      data: {
        deploymentId,
        triggeredById: actorId,
        targetVersion,
        status: 'queued',
        startedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'rollback.started',
      entityType: 'rollback',
      entityId: rollback.id,
      metadata: {
        deploymentId,
        targetVersion,
        previousDeploymentId: previous?.id ?? null,
      },
    });

    await this.deployments.transition(
      deploymentId,
      DeploymentStatus.rolling_back,
      targetVersion
        ? `Rolling back to ${targetVersion} (simulation)`
        : 'Rolling back (no prior success; simulation only)',
    );

    await this.queue.add(
      SIMULATE_ROLLBACK_JOB,
      { deploymentId, rollbackId: rollback.id },
      {
        jobId: `rollback-${deploymentId}`,
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );

    this.logger.log(
      `Rollback ${rollback.id} queued for deployment ${deploymentId}`,
    );

    return this.prisma.rollback.findUniqueOrThrow({
      where: { id: rollback.id },
    });
  }

  async completeSimulation(rollbackId: string, deploymentId: string) {
    const stageDelayMs = Number(process.env.SIM_STAGE_DELAY_MS ?? 400);
    await new Promise((r) => setTimeout(r, stageDelayMs));

    await this.prisma.rollback.update({
      where: { id: rollbackId },
      data: { status: 'in_progress' },
    });

    await new Promise((r) => setTimeout(r, stageDelayMs));

    const rollback = await this.prisma.rollback.update({
      where: { id: rollbackId },
      data: {
        status: 'completed',
        finishedAt: new Date(),
      },
    });

    await this.deployments.transition(
      deploymentId,
      DeploymentStatus.rolled_back,
      rollback.targetVersion
        ? `Rolled back to ${rollback.targetVersion} (simulation complete)`
        : 'Rollback simulation complete',
    );

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });
    if (deployment) {
      await this.audit.log({
        organizationId: deployment.organizationId,
        actorId: null,
        action: 'rollback.completed',
        entityType: 'rollback',
        entityId: rollbackId,
        metadata: {
          deploymentId,
          targetVersion: rollback.targetVersion,
          status: 'completed',
        },
      });
    }

    return rollback;
  }
}
