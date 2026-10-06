jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import { IncidentSeverity, IncidentStatus } from '@prisma/client';
import { IncidentsService } from './incidents.service';

describe('IncidentsService auto-create', () => {
  const prisma = {
    incident: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    incidentEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn(async () => ({})) };
  const realtime = { emitToOrg: jest.fn() };
  const notifications = { notifyOrgRoles: jest.fn(async () => []) };
  let service: IncidentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IncidentsService(
      prisma as never,
      audit as never,
      realtime as never,
      notifications as never,
    );
  });

  it('creates incident once per deployment (idempotent)', async () => {
    prisma.incident.findUnique.mockResolvedValueOnce(null);
    prisma.incident.create.mockResolvedValue({
      id: 'inc-1',
      deploymentId: 'd1',
      source: 'deployment_failure',
    });

    const first = await service.openForDeploymentFailure({
      organizationId: 'o1',
      deploymentId: 'd1',
      serviceId: 's1',
      environmentId: 'e1',
      serviceSlug: 'payments-api',
      environmentSlug: 'prod',
      version: '1.0.0',
      failureReason: 'boom',
    });

    prisma.incident.findUnique.mockResolvedValueOnce(first);
    const second = await service.openForDeploymentFailure({
      organizationId: 'o1',
      deploymentId: 'd1',
      serviceId: 's1',
      environmentId: 'e1',
      serviceSlug: 'payments-api',
      environmentSlug: 'prod',
      version: '1.0.0',
    });

    expect(prisma.incident.create).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(prisma.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: IncidentSeverity.sev1,
          title: expect.stringContaining('payments-api@1.0.0'),
        }),
      }),
    );
  });

  it('dedupes open health incidents within an hour', async () => {
    prisma.incident.findFirst.mockResolvedValue({
      id: 'inc-h',
      status: IncidentStatus.open,
    });
    prisma.incidentEvent.create.mockResolvedValue({});

    const result = await service.openForHealthSignal({
      organizationId: 'o1',
      serviceId: 's1',
      environmentId: 'e1',
      serviceSlug: 'payments-api',
      environmentSlug: 'prod',
      reason: 'Latency high',
      source: 'health_latency',
    });

    expect(result.id).toBe('inc-h');
    expect(prisma.incident.create).not.toHaveBeenCalled();
    expect(prisma.incidentEvent.create).toHaveBeenCalled();
  });

  it('resolves an open incident through legal status path', async () => {
    const openIncident = {
      id: 'inc-1',
      status: IncidentStatus.open,
      severity: IncidentSeverity.sev2,
      resolvedAt: null,
      organizationId: 'o1',
    };
    prisma.incident.findFirst
      .mockResolvedValueOnce(openIncident)
      .mockResolvedValueOnce({
        ...openIncident,
        status: IncidentStatus.resolved,
        resolvedAt: new Date(),
        events: [],
        service: { slug: 'payments-api' },
        environment: { slug: 'prod' },
      });
    prisma.$transaction = jest.fn(async (fn) => {
      const tx = {
        incident: {
          update: jest.fn(async () => ({
            ...openIncident,
            status: IncidentStatus.resolved,
            resolvedAt: new Date(),
          })),
        },
        incidentEvent: { create: jest.fn(async () => ({})) },
      };
      return fn(tx);
    });

    const result = await service.resolve('o1', 'u1', 'inc-1', 'Mitigated');
    expect(result.status).toBe(IncidentStatus.resolved);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'incident.updated' }),
    );
    expect(realtime.emitToOrg).toHaveBeenCalled();
  });

  it('rejects illegal incident status jumps', async () => {
    prisma.incident.findFirst.mockResolvedValue({
      id: 'inc-1',
      status: IncidentStatus.mitigated,
      severity: IncidentSeverity.sev3,
      resolvedAt: null,
    });

    await expect(
      service.update('o1', 'u1', 'inc-1', { status: IncidentStatus.open }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
