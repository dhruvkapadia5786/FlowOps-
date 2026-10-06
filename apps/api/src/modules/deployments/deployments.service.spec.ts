jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DeploymentStatus, OrgRole } from '@prisma/client';
import { DeploymentsService } from './deployments.service';

describe('DeploymentsService', () => {
  const prisma = {
    service: { findFirst: jest.fn() },
    environment: { findFirst: jest.fn() },
    deployment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn(async () => ({})) };
  const queue = { add: jest.fn(async () => ({})) };
  const incidents = {
    openForDeploymentFailure: jest.fn(async () => ({ id: 'inc-1' })),
  };
  const realtime = {
    emitToOrg: jest.fn(),
    emitToDeployment: jest.fn(),
  };
  const notifications = {
    notifyOrgRoles: jest.fn(async () => []),
    notifyUsers: jest.fn(async () => []),
  };

  let service: DeploymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeploymentsService(
      prisma as never,
      audit as never,
      queue as never,
      incidents as never,
      realtime as never,
      notifications as never,
    );
  });

  describe('create RBAC', () => {
    it('blocks viewers from creating deployments', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 's1', isActive: true });
      prisma.environment.findFirst.mockResolvedValue({
        id: 'e1',
        slug: 'dev',
        requiresApproval: false,
      });

      await expect(
        service.create('o1', 'u1', OrgRole.viewer, {
          serviceId: 's1',
          environmentId: 'e1',
          version: '1.0.0',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks developers from creating prod deployments', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 's1', isActive: true });
      prisma.environment.findFirst.mockResolvedValue({
        id: 'e1',
        slug: 'prod',
        requiresApproval: true,
      });

      await expect(
        service.create('o1', 'u1', OrgRole.developer, {
          serviceId: 's1',
          environmentId: 'e1',
          version: '1.0.0',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('queues pipeline for devops on non-prod', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 's1', isActive: true });
      prisma.environment.findFirst.mockResolvedValue({
        id: 'e1',
        slug: 'dev',
        requiresApproval: false,
      });
      prisma.deployment.create.mockResolvedValue({
        id: 'd1',
        version: '1.2.0',
        service: { id: 's1', name: 'Payments', slug: 'payments-api' },
        environment: {
          id: 'e1',
          name: 'Dev',
          slug: 'dev',
          requiresApproval: false,
        },
        triggeredBy: { id: 'u1', fullName: 'Maya', email: 'm@x.io' },
      });

      const result = await service.create('o1', 'u1', OrgRole.devops, {
        serviceId: 's1',
        environmentId: 'e1',
        version: '1.2.0',
      });

      expect(result.id).toBe('d1');
      expect(queue.add).toHaveBeenCalledWith(
        'simulate-pipeline',
        { deploymentId: 'd1' },
        expect.any(Object),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'deployment.create' }),
      );
    });

    it('skips enqueue when options.enqueue is false', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 's1', isActive: true });
      prisma.environment.findFirst.mockResolvedValue({
        id: 'e1',
        slug: 'dev',
        requiresApproval: false,
      });
      prisma.deployment.create.mockResolvedValue({
        id: 'd2',
        version: '1.0.0',
        service: { id: 's1' },
        environment: { id: 'e1' },
        triggeredBy: { id: 'u1' },
      });

      await service.create(
        'o1',
        'u1',
        OrgRole.admin,
        { serviceId: 's1', environmentId: 'e1', version: '1.0.0' },
        { enqueue: false },
      );

      expect(queue.add).not.toHaveBeenCalled();
    });

    it('rejects unknown service', async () => {
      prisma.service.findFirst.mockResolvedValue(null);
      await expect(
        service.create('o1', 'u1', OrgRole.admin, {
          serviceId: 'missing',
          environmentId: 'e1',
          version: '1.0.0',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('transition', () => {
    it('rejects illegal status jumps', async () => {
      prisma.deployment.findUnique.mockResolvedValue({
        id: 'd1',
        status: DeploymentStatus.queued,
        organizationId: 'o1',
        environment: { requiresApproval: false },
      });

      await expect(
        service.transition('d1', DeploymentStatus.success),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('persists event and opens incident on failure from health_check', async () => {
      prisma.deployment.findUnique
        .mockResolvedValueOnce({
          id: 'd1',
          status: DeploymentStatus.health_check,
          organizationId: 'o1',
          environment: { requiresApproval: false },
        })
        .mockResolvedValueOnce({
          id: 'd1',
          organizationId: 'o1',
          serviceId: 's1',
          environmentId: 'e1',
          version: '1.0.0',
          failureReason: 'probe failed',
          service: { slug: 'payments-api' },
          environment: { slug: 'prod' },
        });

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          deployment: {
            update: jest.fn(async () => ({
              id: 'd1',
              status: DeploymentStatus.failed,
            })),
          },
          deploymentEvent: { create: jest.fn(async () => ({})) },
          approval: { upsert: jest.fn() },
          auditLog: { create: jest.fn(async () => ({})) },
        };
        return fn(tx);
      });

      await service.transition(
        'd1',
        DeploymentStatus.failed,
        'Health check failed',
        'probe failed',
      );

      expect(incidents.openForDeploymentFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          deploymentId: 'd1',
          serviceSlug: 'payments-api',
          failureReason: 'probe failed',
        }),
      );
      expect(realtime.emitToDeployment).toHaveBeenCalled();
    });

    it('returns null when deployment missing', async () => {
      prisma.deployment.findUnique.mockResolvedValue(null);
      await expect(
        service.transition('missing', DeploymentStatus.building),
      ).resolves.toBeNull();
    });
  });
});
