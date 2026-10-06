import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DeploymentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { DeploymentsService } from './deployments.service';
import {
  DEPLOYMENTS_QUEUE,
  SIMULATE_PIPELINE_JOB,
} from './deployment-state.machine';

type PipelineJob = { deploymentId: string };

@Processor(DEPLOYMENTS_QUEUE)
export class DeploymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(DeploymentsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deployments: DeploymentsService,
  ) {
    super();
  }

  async process(job: Job<PipelineJob>): Promise<void> {
    if (job.name !== SIMULATE_PIPELINE_JOB) {
      return;
    }

    const { deploymentId } = job.data;
    this.logger.log(`Simulating pipeline for ${deploymentId}`);

    const stageDelayMs = Number(process.env.SIM_STAGE_DELAY_MS ?? 400);
    const buildFailRate = Number(process.env.SIM_BUILD_FAIL_RATE ?? 0);
    const deployFailRate = Number(process.env.SIM_DEPLOY_FAIL_RATE ?? 0);
    const healthFailRate = Number(process.env.SIM_HEALTH_FAIL_RATE ?? 0);
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const roll = (rate: number) => Math.random() < rate;

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

    if (
      deployment.status === DeploymentStatus.success ||
      deployment.status === DeploymentStatus.failed ||
      deployment.status === DeploymentStatus.waiting_for_approval ||
      deployment.status === DeploymentStatus.rolled_back
    ) {
      this.logger.log(
        `Deployment ${deploymentId} already at ${deployment.status}; nothing to do`,
      );
      return;
    }

    if (deployment.status === DeploymentStatus.queued) {
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.building,
        'Build started (simulation)',
      );
      await sleep(stageDelayMs);
      deployment = (await current())!;
    }

    if (deployment.status === DeploymentStatus.building) {
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

    if (deployment.status === DeploymentStatus.testing) {
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
      if (roll(healthFailRate)) {
        await this.deployments.transition(
          deploymentId,
          DeploymentStatus.failed,
          'Health check failed (simulation)',
          'Simulated health check failure',
        );
        return;
      }
      await this.deployments.transition(
        deploymentId,
        DeploymentStatus.success,
        'Deployment succeeded',
      );
    }
  }
}
