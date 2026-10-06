import { DeploymentStatus } from '@prisma/client';
import {
  canTransition,
  DEPLOYMENT_TRANSITIONS,
  TERMINAL_STATUSES,
} from './deployment-state.machine';

describe('deployment state machine', () => {
  it('allows the non-prod happy path', () => {
    const path: DeploymentStatus[] = [
      DeploymentStatus.queued,
      DeploymentStatus.building,
      DeploymentStatus.testing,
      DeploymentStatus.deploying,
      DeploymentStatus.health_check,
      DeploymentStatus.success,
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('allows prod approval pause', () => {
    expect(
      canTransition(
        DeploymentStatus.testing,
        DeploymentStatus.waiting_for_approval,
      ),
    ).toBe(true);
    expect(
      canTransition(
        DeploymentStatus.waiting_for_approval,
        DeploymentStatus.deploying,
      ),
    ).toBe(true);
  });

  it('allows failure from each active stage and full rollback path', () => {
    for (const from of [
      DeploymentStatus.building,
      DeploymentStatus.testing,
      DeploymentStatus.waiting_for_approval,
      DeploymentStatus.deploying,
      DeploymentStatus.health_check,
    ]) {
      expect(canTransition(from, DeploymentStatus.failed)).toBe(true);
    }

    const rollback: DeploymentStatus[] = [
      DeploymentStatus.failed,
      DeploymentStatus.rollback_required,
      DeploymentStatus.rolling_back,
      DeploymentStatus.rolled_back,
    ];
    for (let i = 0; i < rollback.length - 1; i++) {
      expect(canTransition(rollback[i], rollback[i + 1])).toBe(true);
    }
  });

  it('rejects invalid jumps', () => {
    expect(
      canTransition(DeploymentStatus.queued, DeploymentStatus.success),
    ).toBe(false);
    expect(
      canTransition(DeploymentStatus.success, DeploymentStatus.building),
    ).toBe(false);
    expect(
      canTransition(DeploymentStatus.deploying, DeploymentStatus.queued),
    ).toBe(false);
    expect(
      canTransition(DeploymentStatus.rolled_back, DeploymentStatus.failed),
    ).toBe(false);
  });

  it('marks success and rolled_back as terminal (no outgoing edges)', () => {
    expect(DEPLOYMENT_TRANSITIONS[DeploymentStatus.success]).toEqual([]);
    expect(DEPLOYMENT_TRANSITIONS[DeploymentStatus.rolled_back]).toEqual([]);
    expect(TERMINAL_STATUSES).toEqual(
      expect.arrayContaining([
        DeploymentStatus.success,
        DeploymentStatus.rolled_back,
      ]),
    );
  });
});
