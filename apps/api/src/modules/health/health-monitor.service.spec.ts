import { HealthProbeStatus } from '@prisma/client';
import { HealthMonitorService } from './health-monitor.service';

describe('HealthMonitorService.simulateProbe (via runChecks)', () => {
  const prisma = {
    service: { findMany: jest.fn() },
    environment: { findMany: jest.fn() },
    serviceHealthSnapshot: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };
  const incidents = {
    openForHealthSignal: jest.fn(async () => ({ id: 'inc' })),
  };

  let service: HealthMonitorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HealthMonitorService(prisma as never, incidents as never);
    prisma.service.findMany.mockResolvedValue([
      { id: 's1', slug: 'payments-api', name: 'Payments API' },
    ]);
    prisma.environment.findMany.mockResolvedValue([
      {
        id: 'e1',
        slug: 'prod',
        healthCheckConfig: {
          failureThreshold: 2,
          latencyThresholdMs: 100,
          timeoutMs: 5000,
        },
      },
    ]);
    prisma.serviceHealthSnapshot.findUnique.mockResolvedValue({
      consecutiveFailures: 1,
      uptimePercent: 99.0,
    });
    prisma.serviceHealthSnapshot.upsert.mockImplementation(async ({ create }) => ({
      ...create,
      id: 'snap-1',
      overallStatus: create.overallStatus,
      avgLatencyMs: create.avgLatencyMs,
      consecutiveFailures: create.consecutiveFailures,
      probes: [],
      service: { id: 's1', slug: 'payments-api', name: 'Payments API' },
      environment: { id: 'e1', slug: 'prod', name: 'Production' },
    }));
  });

  it('opens unavailability incident when forceUnhealthy', async () => {
    await service.runChecks('o1', { forceUnhealthy: true });

    expect(incidents.openForHealthSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'health_unavailability',
        serviceSlug: 'payments-api',
      }),
    );
    expect(prisma.serviceHealthSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          overallStatus: HealthProbeStatus.unhealthy,
          consecutiveFailures: 2,
        }),
      }),
    );
  });

  it('opens latency incident when forceHighLatency', async () => {
    prisma.serviceHealthSnapshot.findUnique.mockResolvedValue(null);
    await service.runChecks('o1', { forceHighLatency: true });

    expect(incidents.openForHealthSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'health_latency',
      }),
    );
  });
});
