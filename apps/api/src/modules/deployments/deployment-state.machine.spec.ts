import { DeploymentStatus } from '@prisma/client';
import { canTransition } from './deployment-state.machine';

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
  });
});
