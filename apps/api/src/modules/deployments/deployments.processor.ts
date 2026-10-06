import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { DeploymentStatus, HealthProbeStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { HealthMonitorService } from '../health/health-monitor.service';
import { RollbackService } from '../rollback/rollback.service';
import { DeploymentsService } from './deployments.service';
import {
  CONTINUE_PIPELINE_JOB,
  DEPLOYMENTS_QUEUE,
  SIMULATE_PIPELINE_JOB,
  SIMULATE_ROLLBACK_JOB,
} from './deployment-state.machine';

type PipelineJob = { deploymentId: string; rollbackId?: string };

@Processor(DEPLOYMENTS_QUEUE)
export class DeploymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(DeploymentsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
    @Inject(forwardRef(() => RollbackService))
    private readonly rollbacks: RollbackService,
    @Inject(forwardRef(() => HealthMonitorService))
    private readonly healthMonitor: HealthMonitorService,
  ) {
    super();
  }

  async process(job: Job<PipelineJob>): Promise<void> {
    if (job.name === SIMULATE_ROLLBACK_JOB) {
      if (!job.data.rollbackId) {
        this.logger.error('Rollback job missing rollbackId');
        return;
      }
      await this.rollbacks.completeSimulation(
        job.data.rollbackId,
        job.data.deploymentId,
      );
      return;
    }

    if (
      job.name !== SIMULATE_PIPELINE_JOB &&
      job.name !== CONTINUE_PIPELINE_JOB
    ) {
      return;
    }

    const { deploymentId } = job.data;
    const isContinue = job.name === CONTINUE_PIPELINE_JOB;
    this.logger.log(
      `${isContinue ? 'Continuing' : 'Simulating'} pipeline for ${deploymentId}`,
    );

    const current = async () =>
      this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: { environment: true },
      });

    let deployment = await current();
    if (!deployment) {
      this.logger.warn(`Deployment ${deploymentId} missing; skipping`);
      return;
    }

    const orgSettings = await this.prisma.simulationSettings.findUnique({
      where: { organizationId: deployment.organizationId },
    });
    const stageDelayMs =
      orgSettings?.stageDelayMs ??
      Number(process.env.SIM_STAGE_DELAY_MS ?? 400);
    const buildFailRate =
      orgSettings?.buildFailRate ??
      Number(process.env.SIM_BUILD_FAIL_RATE ?? 0);
    const deployFailRate =
      orgSettings?.deployFailRate ??
      Number(process.env.SIM_DEPLOY_FAIL_RATE ?? 0);
    const healthFailRate =
      orgSettings?.healthFailRate ??
      Number(process.env.SIM_HEALTH_FAIL_RATE ?? 0);
    const deterministic =
      orgSettings?.deterministic ?? process.env.SIM_DETERMINISTIC === 'true';

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const roll = (rate: number) => {
      if (rate <= 0) {
        return false;
      }
      if (deterministic) {
        // Stable-ish demo: hash deployment id + rate bucket
        let hash = 0;
        for (const ch of deploymentId) {
          hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
        }
        return hash % 1000 < Math.floor(rate * 1000);
      }
      return Math.random() < rate;
    };

    if (
      deployment.status === DeploymentStatus.success ||
      deployment.status === DeploymentStatus.failed ||
      deployment.status === DeploymentStatus.rolled_back ||
      (!isContinue &&
        deployment.status === DeploymentStatus.waiting_for_approval)
    ) {
      this.logger.log(
        `Deployment ${deploymentId} already at ${deployment.status}; nothing to do`,
      );
      return;
    }

    if (!isContinue && deployment.status === DeploymentStatus.queued) {
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.building,
        'Build started (simulation)',
      );
      await sleep(stageDelayMs);
      deployment = (await current())!;
    }

    if (!isContinue && deployment.status === DeploymentStatus.building) {
      if (roll(buildFailRate)) {
        await this.deployments.transition(
          deploymentId,
          DeploymentStatus.failed,
          'Build failed (simulation)',
          'Simulated build failure',
        );
        return;
      }
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.testing,
        'Tests passed (simulation)',
      );
      await sleep(stageDelayMs);
      deployment = (await current())!;
    }

    if (!isContinue && deployment.status === DeploymentStatus.testing) {
      if (deployment.environment.requiresApproval) {
        await this.deployments.transition(
          deploymentId,
          DeploymentStatus.waiting_for_approval,
          'Awaiting production approval',
        );
        return;
      }
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.deploying,
        'Deploying to environment (simulation)',
      );
      await sleep(stageDelayMs);
      deployment = (await current())!;
    }

    if (deployment.status === DeploymentStatus.deploying) {
      if (roll(deployFailRate)) {
        await this.deployments.transition(
          deploymentId,
          DeploymentStatus.failed,
          'Deploy failed (simulation)',
          'Simulated deploy failure',
        );
        return;
      }
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.health_check,
        'Running health checks (simulation)',
      );
      await sleep(stageDelayMs);
      deployment = (await current())!;
    }

    if (deployment.status === DeploymentStatus.health_check) {
      const forceUnhealthy = roll(healthFailRate);
      const snapshots = await this.healthMonitor.runChecks(
        deployment.organizationId,
        {
          serviceId: deployment.serviceId,
          environmentId: deployment.environmentId,
          forceUnhealthy,
        },
        { deploymentId },
      );
      const snap = snapshots[0];
      const unhealthy =
        forceUnhealthy || snap?.overallStatus === HealthProbeStatus.unhealthy;

      if (unhealthy) {
        await this.deployments.transition(
          deploymentId,
          DeploymentStatus.failed,
          'Health check failed (simulation)',
          snap
            ? `Health ${snap.overallStatus}; latency ${snap.avgLatencyMs}ms`
            : 'Simulated health check failure',
        );
        return;
      }

      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.success,
        'Deployment succeeded — health probes passed',
      );
    }
  }
}
