import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  HealthProbeStatus,
  HealthProbeType,
  IncidentSeverity,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { IncidentsService } from '../incidents/incidents.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import {
  RunHealthChecksDto,
  UpsertHealthConfigDto,
} from './dto/health-monitor.dto';

const PROBE_TYPES: HealthProbeType[] = [
  HealthProbeType.api,
  HealthProbeType.db,
  HealthProbeType.redis,
  HealthProbeType.queue,
  HealthProbeType.external,
];

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly realtime: RealtimeService,
  ) {}

  getConfig(orgId: string, environmentId: string) {
    return this.prisma.healthCheckConfig.findFirst({
      where: { environmentId, environment: { organizationId: orgId } },
      include: {
        environment: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async upsertConfig(
    orgId: string,
    environmentId: string,
    dto: UpsertHealthConfigDto,
  ) {
    const env = await this.prisma.environment.findFirst({
      where: { id: environmentId, organizationId: orgId },
    });
    if (!env) {
      throw new NotFoundException('Environment not found');
    }

    return this.prisma.healthCheckConfig.upsert({
      where: { environmentId },
      create: {
        environmentId,
        endpointPath: dto.endpointPath ?? '/health',
        timeoutMs: dto.timeoutMs ?? 5000,
        successThreshold: dto.successThreshold ?? 1,
        failureThreshold: dto.failureThreshold ?? 3,
        latencyThresholdMs: dto.latencyThresholdMs ?? 500,
      },
      update: {
        endpointPath: dto.endpointPath,
        timeoutMs: dto.timeoutMs,
        successThreshold: dto.successThreshold,
        failureThreshold: dto.failureThreshold,
        latencyThresholdMs: dto.latencyThresholdMs,
      },
      include: {
        environment: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  listSnapshots(orgId: string) {
    return this.prisma.serviceHealthSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: [{ overallStatus: 'desc' }, { checkedAt: 'desc' }],
      include: {
        service: { select: { id: true, name: true, slug: true } },
        environment: { select: { id: true, name: true, slug: true } },
        probes: { orderBy: { probeType: 'asc' } },
      },
    });
  }

  async getSnapshot(orgId: string, serviceId: string, environmentId: string) {
    const snap = await this.prisma.serviceHealthSnapshot.findFirst({
      where: { organizationId: orgId, serviceId, environmentId },
      include: {
        service: { select: { id: true, name: true, slug: true } },
        environment: { select: { id: true, name: true, slug: true } },
        probes: { orderBy: { probeType: 'asc' } },
      },
    });
    if (!snap) {
      throw new NotFoundException('Health snapshot not found');
    }
    return snap;
  }

  /**
   * Run simulated probes for service×environment pairs and evaluate thresholds.
   */
  async runChecks(
    orgId: string,
    dto: RunHealthChecksDto = {},
    opts?: { deploymentId?: string },
  ) {
    const services = await this.prisma.service.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(dto.serviceId ? { id: dto.serviceId } : {}),
      },
    });
    const environments = await this.prisma.environment.findMany({
      where: {
        organizationId: orgId,
        ...(dto.environmentId ? { id: dto.environmentId } : {}),
      },
      include: { healthCheckConfig: true },
    });

    const results = [];
    for (const service of services) {
      for (const env of environments) {
        const snapshot = await this.checkOne(
          orgId,
          service,
          env,
          env.healthCheckConfig,
          dto,
          opts?.deploymentId,
        );
        results.push(snapshot);
      }
    }
    return results;
  }

  private async checkOne(
    orgId: string,
    service: { id: string; slug: string; name: string },
    env: {
      id: string;
      slug: string;
      healthCheckConfig: {
        failureThreshold: number;
        latencyThresholdMs: number;
        timeoutMs: number;
      } | null;
    },
    config: {
      failureThreshold: number;
      latencyThresholdMs: number;
      timeoutMs: number;
    } | null,
    dto: RunHealthChecksDto,
    deploymentId?: string,
  ) {
    const failureThreshold = config?.failureThreshold ?? 3;
    const latencyThreshold = config?.latencyThresholdMs ?? 500;
    const previous = await this.prisma.serviceHealthSnapshot.findUnique({
      where: {
        serviceId_environmentId: {
          serviceId: service.id,
          environmentId: env.id,
        },
      },
    });

    const probes = PROBE_TYPES.map((probeType) =>
      this.simulateProbe(probeType, dto, latencyThreshold),
    );

    const avgLatencyMs = Math.round(
      probes.reduce((sum, p) => sum + p.latencyMs, 0) / probes.length,
    );
    const anyUnhealthy = probes.some(
      (p) => p.status === HealthProbeStatus.unhealthy,
    );
    const anyDegraded = probes.some(
      (p) => p.status === HealthProbeStatus.degraded,
    );
    const highLatency = avgLatencyMs > latencyThreshold;

    let overallStatus: HealthProbeStatus = HealthProbeStatus.healthy;
    if (anyUnhealthy) {
      overallStatus = HealthProbeStatus.unhealthy;
    } else if (anyDegraded || highLatency) {
      overallStatus = HealthProbeStatus.degraded;
    }

    const failedNow =
      overallStatus === HealthProbeStatus.unhealthy || highLatency;
    const consecutiveFailures = failedNow
      ? (previous?.consecutiveFailures ?? 0) + 1
      : 0;

    // Simulated rolling uptime: decay on failure, recover on success
    const prevUptime = previous?.uptimePercent ?? 99.5;
    const uptimePercent = failedNow
      ? Math.max(85, Number((prevUptime - 0.4).toFixed(2)))
      : Math.min(99.99, Number((prevUptime + 0.05).toFixed(2)));

    const snapshot = await this.prisma.serviceHealthSnapshot.upsert({
      where: {
        serviceId_environmentId: {
          serviceId: service.id,
          environmentId: env.id,
        },
      },
      create: {
        organizationId: orgId,
        serviceId: service.id,
        environmentId: env.id,
        overallStatus,
        uptimePercent,
        avgLatencyMs,
        consecutiveFailures,
        checkedAt: new Date(),
        probes: {
          create: probes.map((p) => ({
            probeType: p.probeType,
            status: p.status,
            latencyMs: p.latencyMs,
            message: p.message,
          })),
        },
      },
      update: {
        overallStatus,
        uptimePercent,
        avgLatencyMs,
        consecutiveFailures,
        checkedAt: new Date(),
        probes: {
          deleteMany: {},
          create: probes.map((p) => ({
            probeType: p.probeType,
            status: p.status,
            latencyMs: p.latencyMs,
            message: p.message,
          })),
        },
      },
      include: {
        probes: true,
        service: { select: { id: true, name: true, slug: true } },
        environment: { select: { id: true, name: true, slug: true } },
      },
    });

    // Auto-incidents
    if (anyUnhealthy) {
      await this.incidents.openForHealthSignal({
        organizationId: orgId,
        serviceId: service.id,
        environmentId: env.id,
        serviceSlug: service.slug,
        environmentSlug: env.slug,
        reason: `Service unavailable: unhealthy probes (${probes
          .filter((p) => p.status === HealthProbeStatus.unhealthy)
          .map((p) => p.probeType)
          .join(', ')})`,
        source: 'health_unavailability',
        severity:
          env.slug === 'prod' ? IncidentSeverity.sev1 : IncidentSeverity.sev2,
        deploymentId,
      });
    } else if (consecutiveFailures >= failureThreshold) {
      await this.incidents.openForHealthSignal({
        organizationId: orgId,
        serviceId: service.id,
        environmentId: env.id,
        serviceSlug: service.slug,
        environmentSlug: env.slug,
        reason: `Repeated health failures: ${consecutiveFailures} consecutive (threshold ${failureThreshold})`,
        source: 'health_repeated_failures',
        severity: IncidentSeverity.sev2,
        deploymentId,
      });
    } else if (highLatency) {
      await this.incidents.openForHealthSignal({
        organizationId: orgId,
        serviceId: service.id,
        environmentId: env.id,
        serviceSlug: service.slug,
        environmentSlug: env.slug,
        reason: `Latency ${avgLatencyMs}ms exceeds threshold ${latencyThreshold}ms`,
        source: 'health_latency',
        severity: IncidentSeverity.sev3,
        deploymentId,
      });
    }

    this.logger.log(
      `Health ${service.slug}@${env.slug}: ${overallStatus} latency=${avgLatencyMs}ms failures=${consecutiveFailures}`,
    );

    this.realtime.emitToOrg(orgId, REALTIME_EVENTS.HEALTH_UPDATED, {
      serviceId: service.id,
      serviceSlug: service.slug,
      environmentId: env.id,
      environmentSlug: env.slug,
      overallStatus,
      avgLatencyMs,
      consecutiveFailures,
      uptimePercent,
      checkedAt: snapshot.checkedAt,
    });

    return snapshot;
  }

  private simulateProbe(
    probeType: HealthProbeType,
    dto: RunHealthChecksDto,
    latencyThreshold: number,
  ): {
    probeType: HealthProbeType;
    status: HealthProbeStatus;
    latencyMs: number;
    message: string;
  } {
    if (dto.forceUnhealthy) {
      return {
        probeType,
        status: HealthProbeStatus.unhealthy,
        latencyMs: latencyThreshold + 200,
        message: 'Forced unhealthy (simulation)',
      };
    }

    if (dto.forceProbeType && dto.forceProbeType === probeType) {
      return {
        probeType,
        status: HealthProbeStatus.unhealthy,
        latencyMs: latencyThreshold + 250,
        message: `Forced ${probeType} failure (simulation)`,
      };
    }

    const baseLatency: Record<HealthProbeType, number> = {
      api: 40,
      db: 25,
      redis: 5,
      queue: 15,
      external: 120,
    };

    let latencyMs = baseLatency[probeType] + Math.floor(Math.random() * 30);
    if (dto.forceHighLatency) {
      latencyMs = latencyThreshold + 150 + Math.floor(Math.random() * 100);
    }

    let status: HealthProbeStatus = HealthProbeStatus.healthy;
    let message = 'OK (simulation)';
    if (latencyMs > latencyThreshold) {
      status = HealthProbeStatus.degraded;
      message = 'Elevated latency (simulation)';
    }
    // Rare random blip unless forced healthy path
    if (!dto.forceHighLatency && Math.random() < 0.02) {
      status = HealthProbeStatus.degraded;
      message = 'Transient degradation (simulation)';
      latencyMs += 80;
    }

    return { probeType, status, latencyMs, message };
  }
}
