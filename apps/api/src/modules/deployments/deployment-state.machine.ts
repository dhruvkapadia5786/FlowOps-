import { DeploymentStatus } from '@prisma/client';

/** Legal deployment status transitions (ARCHITECTURE / DATABASE_DESIGN). */
export const DEPLOYMENT_TRANSITIONS: Record<
  DeploymentStatus,
  DeploymentStatus[]
> = {
  queued: [DeploymentStatus.building],
  building: [DeploymentStatus.testing, DeploymentStatus.failed],
  testing: [
    DeploymentStatus.waiting_for_approval,
    DeploymentStatus.deploying,
    DeploymentStatus.failed,
  ],
  waiting_for_approval: [DeploymentStatus.deploying, DeploymentStatus.failed],
  deploying: [DeploymentStatus.health_check, DeploymentStatus.failed],
  health_check: [DeploymentStatus.success, DeploymentStatus.failed],
  failed: [DeploymentStatus.rollback_required],
  rollback_required: [DeploymentStatus.rolling_back],
  rolling_back: [DeploymentStatus.rolled_back],
  success: [],
  rolled_back: [],
};

export function canTransition(
  from: DeploymentStatus,
  to: DeploymentStatus,
): boolean {
  return DEPLOYMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export const TERMINAL_STATUSES: DeploymentStatus[] = [
  DeploymentStatus.success,
  DeploymentStatus.rolled_back,
  DeploymentStatus.waiting_for_approval, // paused until M4 approval continue
];

export const DEPLOYMENTS_QUEUE = 'deployments';
export const SIMULATE_PIPELINE_JOB = 'simulate-pipeline';
