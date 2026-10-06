jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

import { DeploymentStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { RollbackService } from './rollback.service';

describe('RollbackService.start', () => {
  const prisma = {
    deployment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    rollback: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const audit = { log: jest.fn(async () => ({})) };
  const deployments = { transition: jest.fn(async () => ({})) };
  const queue = { add: jest.fn(async () => ({})) };

  let service: RollbackService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RollbackService(
      prisma as never,
      audit as never,
      deployments as never,
      queue as never,
    );
  });

  it('promotes failed → rollback_required and targets prior success version', async () => {
    prisma.deployment.findFirst
      .mockResolvedValueOnce({
        id: 'd-fail',
        organizationId: 'o1',
        serviceId: 's1',
        environmentId: 'e1',
        status: DeploymentStatus.failed,
        createdAt: new Date('2026-10-06T10:00:00Z'),
        rollback: null,
        service: { slug: 'payments-api' },
        environment: { slug: 'prod' },
      })
      .mockResolvedValueOnce({
        id: 'd-ok',
        version: '1.13.0',
      });
    prisma.rollback.create.mockResolvedValue({
      id: 'r1',
      deploymentId: 'd-fail',
      targetVersion: '1.13.0',
      status: 'queued',
    });
    prisma.rollback.findUniqueOrThrow.mockResolvedValue({
      id: 'r1',
      targetVersion: '1.13.0',
      status: 'queued',
    });

    const result = await service.start('o1', 'd-fail', 'u1');

    expect(deployments.transition).toHaveBeenNthCalledWith(
      1,
      'd-fail',
      DeploymentStatus.rollback_required,
      expect.any(String),
    );
    expect(deployments.transition).toHaveBeenNthCalledWith(
      2,
      'd-fail',
      DeploymentStatus.rolling_back,
      expect.stringContaining('1.13.0'),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'simulate-rollback',
      { deploymentId: 'd-fail', rollbackId: 'r1' },
      expect.any(Object),
    );
    expect(result.targetVersion).toBe('1.13.0');
  });

  it('rejects when status is success', async () => {
    prisma.deployment.findFirst.mockResolvedValue({
      id: 'd1',
      status: DeploymentStatus.success,
      rollback: null,
    });

    await expect(service.start('o1', 'd1', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
