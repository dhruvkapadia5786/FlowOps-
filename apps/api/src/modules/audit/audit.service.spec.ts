import { AuditService } from './audit.service';

describe('AuditService', () => {
  const prisma = {
    auditLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    deployment: { findMany: jest.fn() },
    incident: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditService(prisma as never);
  });

  it('lists audit logs with actor and action filters', async () => {
    prisma.deployment.findMany.mockResolvedValue([]);
    prisma.incident.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        action: 'deployment.created',
        entityType: 'deployment',
        actor: { id: 'u1', fullName: 'Maya Chen', email: 'maya@x.io' },
      },
    ]);

    const result = await service.list('org-1', {
      page: 1,
      pageSize: 20,
      actorId: 'u1',
      action: 'deployment',
    });

    expect(result.meta.total).toBe(1);
    expect(result.data[0].action).toBe('deployment.created');
    expect(prisma.auditLog.findMany).toHaveBeenCalled();
  });

  it('expands environment filter to related deployments/incidents', async () => {
    prisma.deployment.findMany.mockResolvedValue([{ id: 'd1' }]);
    prisma.incident.findMany.mockResolvedValue([{ id: 'i1' }]);
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    prisma.auditLog.count.mockResolvedValue(0);
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.list('org-1', {
      page: 1,
      pageSize: 20,
      environmentId: 'env-1',
    });

    const where = prisma.auditLog.findMany.mock.calls[0][0].where;
    expect(where.AND).toBeDefined();
    expect(prisma.deployment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', environmentId: 'env-1' },
      }),
    );
  });
});
