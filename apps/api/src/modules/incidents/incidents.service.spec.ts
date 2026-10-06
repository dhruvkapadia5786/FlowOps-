jest.mock('@nestjs/bullmq', () => ({
  InjectQueue: () => () => undefined,
}));

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
});
