import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeploymentStatus,
  HealthProbeType,
  IncidentStatus,
  OrgRole,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { HealthMonitorService } from '../health/health-monitor.service';
import { IncidentsService } from '../incidents/incidents.service';
import { REALTIME_EVENTS } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { RollbackService } from '../rollback/rollback.service';
import {
  ChaosBurstDto,
  RunScenarioDto,
  UpdateSimulationSettingsDto,
} from './dto/simulation.dto';

export type SimulationEffect = {
  id: string;
  scenarioKey: string;
  label: string;
  serviceId?: string;
  environmentId?: string;
  incidentId?: string;
  deploymentId?: string;
  startedAt: string;
  note?: string;
};

export type ScenarioDef = {
  key: string;
  label: string;
  description: string;
  category: 'health' | 'pipeline' | 'recovery';
  defaultServiceSlug?: string;
  defaultEnvironmentSlug?: string;
  recoverable: boolean;
};

export const SCENARIOS: ScenarioDef[] = [
  {
    key: 'payment_api_failure',
    label: 'Simulate Payment API Failure',
    description:
      'Marks payments-api unhealthy, raises latency, generates probe failures, and opens an incident (local simulation only).',
    category: 'health',
    defaultServiceSlug: 'payments-api',
    defaultEnvironmentSlug: 'prod',
    recoverable: true,
  },
  {
    key: 'api_timeout',
    label: 'Simulate API Timeout',
    description: 'Forces the API probe unhealthy with elevated latency.',
    category: 'health',
    defaultServiceSlug: 'payments-api',
    defaultEnvironmentSlug: 'prod',
    recoverable: true,
  },
  {
    key: 'db_failure',
    label: 'Simulate DB Failure',
    description: 'Forces the database probe unhealthy for the target service.',
    category: 'health',
    defaultServiceSlug: 'payments-api',
    defaultEnvironmentSlug: 'prod',
    recoverable: true,
  },
  {
    key: 'redis_outage',
    label: 'Simulate Redis Outage',
    description: 'Forces the Redis probe unhealthy for the target service.',
    category: 'health',
    defaultServiceSlug: 'checkout-web',
    defaultEnvironmentSlug: 'prod',
    recoverable: true,
  },
  {
    key: 'health_check_failure',
    label: 'Simulate Health Check Failure',
    description: 'Runs forced unhealthy health checks across all probes.',
    category: 'health',
    defaultServiceSlug: 'order-orchestrator',
    defaultEnvironmentSlug: 'uat',
    recoverable: true,
  },
  {
    key: 'high_latency',
    label: 'Simulate High Latency',
    description: 'Raises probe latency above configured thresholds (degraded).',
    category: 'health',
    defaultServiceSlug: 'catalog-api',
    defaultEnvironmentSlug: 'qa',
    recoverable: true,
  },
  {
    key: 'deployment_failure',
    label: 'Simulate Deployment Failure',
    description:
      'Queues a non-prod deployment and fails it in the pipeline (creates incident).',
    category: 'pipeline',
    defaultServiceSlug: 'inventory-worker',
    defaultEnvironmentSlug: 'dev',
    recoverable: false,
  },
  {
    key: 'rollback',
    label: 'Simulate Rollback',
    description:
      'Starts a rollback on a failed/rollback_required deployment (or creates one first).',
    category: 'pipeline',
    defaultServiceSlug: 'inventory-worker',
    defaultEnvironmentSlug: 'dev',
    recoverable: false,
  },
];

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly health: HealthMonitorService,
    private readonly incidents: IncidentsService,
    private readonly deployments: DeploymentsService,
    private readonly rollbacks: RollbackService,
    private readonly realtime: RealtimeService,
  ) {}

  listScenarios() {
    return {
      simulationMode: true,
      framing:
        'Local simulation only — FlowOps does not touch real production infrastructure.',
      scenarios: SCENARIOS,
    };
  }

  async getSettings(orgId: string) {
    const settings = await this.ensureSettings(orgId);
    return this.serializeSettings(settings);
  }

  async updateSettings(
    orgId: string,
    actorId: string,
    dto: UpdateSimulationSettingsDto,
  ) {
    await this.ensureSettings(orgId);
    const settings = await this.prisma.simulationSettings.update({
      where: { organizationId: orgId },
      data: {
        ...(dto.buildFailRate !== undefined
          ? { buildFailRate: dto.buildFailRate }
          : {}),
        ...(dto.deployFailRate !== undefined
          ? { deployFailRate: dto.deployFailRate }
          : {}),
        ...(dto.healthFailRate !== undefined
          ? { healthFailRate: dto.healthFailRate }
          : {}),
        ...(dto.stageDelayMs !== undefined
          ? { stageDelayMs: dto.stageDelayMs }
          : {}),
        ...(dto.deterministic !== undefined
          ? { deterministic: dto.deterministic }
          : {}),
      },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'simulation.settings_updated',
      entityType: 'simulation_settings',
      entityId: settings.id,
      metadata: dto as unknown as Prisma.InputJsonValue,
    });

    this.emit(orgId, settings);
    return this.serializeSettings(settings);
  }

  async getKnobsForOrg(orgId: string) {
    const s = await this.ensureSettings(orgId);
    return {
      simulationMode: s.simulationMode,
      buildFailRate: s.buildFailRate,
      deployFailRate: s.deployFailRate,
      healthFailRate: s.healthFailRate,
      stageDelayMs: s.stageDelayMs,
      deterministic: s.deterministic,
    };
  }

  async runScenario(
    orgId: string,
    actorId: string,
    role: OrgRole | undefined,
    key: string,
    dto: RunScenarioDto,
  ) {
    const scenario = SCENARIOS.find((s) => s.key === key);
    if (!scenario) {
      throw new NotFoundException(`Unknown scenario: ${key}`);
    }

    const target = await this.resolveTarget(orgId, scenario, dto);

    switch (key) {
      case 'payment_api_failure':
        return this.runHealthFailure(orgId, actorId, scenario, target, {
          forceUnhealthy: true,
          forceHighLatency: true,
          repeats: 3,
        });
      case 'api_timeout':
        return this.runHealthFailure(orgId, actorId, scenario, target, {
          forceProbeType: HealthProbeType.api,
          forceHighLatency: true,
          repeats: 2,
        });
      case 'db_failure':
        return this.runHealthFailure(orgId, actorId, scenario, target, {
          forceProbeType: HealthProbeType.db,
          repeats: 2,
        });
      case 'redis_outage':
        return this.runHealthFailure(orgId, actorId, scenario, target, {
          forceProbeType: HealthProbeType.redis,
          repeats: 2,
        });
      case 'health_check_failure':
        return this.runHealthFailure(orgId, actorId, scenario, target, {
          forceUnhealthy: true,
          repeats: 2,
        });
      case 'high_latency':
        return this.runHealthFailure(orgId, actorId, scenario, target, {
          forceHighLatency: true,
          repeats: 2,
        });
      case 'deployment_failure':
        return this.runDeploymentFailure(
          orgId,
          actorId,
          role,
          scenario,
          target,
        );
      case 'rollback':
        return this.runRollback(orgId, actorId, scenario, target);
      default:
        throw new BadRequestException(`Scenario not implemented: ${key}`);
    }
  }

  async recoverScenario(
    orgId: string,
    actorId: string,
    key: string,
    effectId?: string,
  ) {
    const scenario = SCENARIOS.find((s) => s.key === key);
    if (!scenario) {
      throw new NotFoundException(`Unknown scenario: ${key}`);
    }
    if (!scenario.recoverable) {
      throw new BadRequestException('This scenario is not recoverable');
    }

    const settings = await this.ensureSettings(orgId);
    const effects = this.readEffects(settings.activeEffects);
    const match = effectId
      ? effects.find((e) => e.id === effectId && e.scenarioKey === key)
      : [...effects].reverse().find((e) => e.scenarioKey === key);
    if (!match) {
      throw new NotFoundException('No active effect for this scenario');
    }
    if (!match.serviceId || !match.environmentId) {
      throw new BadRequestException('Effect missing service/environment');
    }

    const snapshot = await this.health.runChecks(orgId, {
      serviceId: match.serviceId,
      environmentId: match.environmentId,
    });

    if (match.incidentId) {
      const open = await this.prisma.incident.findFirst({
        where: {
          id: match.incidentId,
          organizationId: orgId,
          status: { not: IncidentStatus.resolved },
        },
      });
      if (open) {
        await this.incidents.resolve(
          orgId,
          actorId,
          open.id,
          'Recovered via simulation control panel (local only)',
        );
      }
    }

    const nextEffects = effects.filter((e) => e.id !== match.id);
    const updated = await this.prisma.simulationSettings.update({
      where: { organizationId: orgId },
      data: { activeEffects: nextEffects },
    });

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'simulation.recovered',
      entityType: 'simulation_effect',
      entityId: match.id,
      metadata: {
        scenarioKey: key,
        serviceId: match.serviceId,
        environmentId: match.environmentId,
      },
    });

    this.emit(orgId, updated);
    return {
      simulationMode: true,
      recovered: match,
      health: snapshot,
      settings: this.serializeSettings(updated),
    };
  }

  async runChaosBurst(
    orgId: string,
    actorId: string,
    role: OrgRole | undefined,
    dto: ChaosBurstDto,
  ) {
    const count = dto.count ?? 5;
    const services = await this.prisma.service.findMany({
      where: { organizationId: orgId, isActive: true },
    });
    if (!services.length) {
      throw new BadRequestException('No active services');
    }

    const environment = dto.environmentId
      ? await this.prisma.environment.findFirst({
          where: { id: dto.environmentId, organizationId: orgId },
        })
      : await this.prisma.environment.findFirst({
          where: {
            organizationId: orgId,
            OR: [{ slug: 'dev' }, { slug: 'qa' }],
            requiresApproval: false,
          },
          orderBy: { sortOrder: 'asc' },
        });
    if (!environment) {
      throw new NotFoundException('No suitable non-prod environment');
    }

    const created = [];
    for (let i = 0; i < count; i++) {
      const service = services[i % services.length];
      const dep = await this.deployments.create(orgId, actorId, role, {
        serviceId: service.id,
        environmentId: environment.id,
        version: `chaos-${Date.now()}-${i}`,
        commitSha: randomUUID().replace(/-/g, '').slice(0, 7),
      });
      created.push({ id: dep.id, service: service.slug, version: dep.version });
    }

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'simulation.chaos_burst',
      entityType: 'organization',
      entityId: orgId,
      metadata: { count, environmentId: environment.id },
    });

    const settings = await this.ensureSettings(orgId);
    this.emit(orgId, settings);

    return {
      simulationMode: true,
      framing: 'Chaos burst queued locally — not real infrastructure.',
      created,
    };
  }

  private async runHealthFailure(
    orgId: string,
    actorId: string,
    scenario: ScenarioDef,
    target: {
      serviceId: string;
      environmentId: string;
      serviceSlug: string;
      environmentSlug: string;
    },
    opts: {
      forceUnhealthy?: boolean;
      forceHighLatency?: boolean;
      forceProbeType?: HealthProbeType;
      repeats: number;
    },
  ) {
    let snapshot = null as
      Awaited<ReturnType<HealthMonitorService['runChecks']>>[number] | null;
    for (let i = 0; i < opts.repeats; i++) {
      const results = await this.health.runChecks(orgId, {
        serviceId: target.serviceId,
        environmentId: target.environmentId,
        forceUnhealthy: opts.forceUnhealthy,
        forceHighLatency: opts.forceHighLatency,
        forceProbeType: opts.forceProbeType,
      });
      snapshot = results[0] ?? null;
    }

    const incident = await this.prisma.incident.findFirst({
      where: {
        organizationId: orgId,
        serviceId: target.serviceId,
        environmentId: target.environmentId,
        status: { not: IncidentStatus.resolved },
      },
      orderBy: { openedAt: 'desc' },
    });

    const effect: SimulationEffect = {
      id: randomUUID(),
      scenarioKey: scenario.key,
      label: scenario.label,
      serviceId: target.serviceId,
      environmentId: target.environmentId,
      incidentId: incident?.id,
      startedAt: new Date().toISOString(),
      note: `${target.serviceSlug}@${target.environmentSlug}`,
    };

    const settings = await this.pushEffect(orgId, effect);
    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'simulation.scenario_run',
      entityType: 'simulation_effect',
      entityId: effect.id,
      metadata: {
        scenarioKey: scenario.key,
        serviceId: target.serviceId,
        environmentId: target.environmentId,
        environmentSlug: target.environmentSlug,
      },
    });

    this.emit(orgId, settings);
    this.logger.warn(
      `Simulation ${scenario.key} on ${target.serviceSlug}@${target.environmentSlug} (local only)`,
    );

    return {
      simulationMode: true,
      framing: 'Local simulation only — no real production impact.',
      effect,
      health: snapshot,
      incident,
      settings: this.serializeSettings(settings),
    };
  }

  private async runDeploymentFailure(
    orgId: string,
    actorId: string,
    role: OrgRole | undefined,
    scenario: ScenarioDef,
    target: {
      serviceId: string;
      environmentId: string;
      serviceSlug: string;
      environmentSlug: string;
    },
  ) {
    const env = await this.prisma.environment.findFirstOrThrow({
      where: { id: target.environmentId },
    });
    if (env.requiresApproval || env.slug === 'prod') {
      throw new BadRequestException(
        'Deployment failure scenario uses non-prod environments only',
      );
    }

    const dep = await this.deployments.create(
      orgId,
      actorId,
      role,
      {
        serviceId: target.serviceId,
        environmentId: target.environmentId,
        version: `sim-fail-${Date.now()}`,
        commitSha: randomUUID().replace(/-/g, '').slice(0, 7),
      },
      { enqueue: false },
    );

    await this.deployments.transition(
      dep.id,
      DeploymentStatus.building,
      'Simulation: build started',
    );
    await this.deployments.transition(
      dep.id,
      DeploymentStatus.failed,
      'Simulated deployment failure (local only)',
      'Forced failure via simulation control panel',
    );

    const effect: SimulationEffect = {
      id: randomUUID(),
      scenarioKey: scenario.key,
      label: scenario.label,
      serviceId: target.serviceId,
      environmentId: target.environmentId,
      deploymentId: dep.id,
      startedAt: new Date().toISOString(),
      note: `Forced fail ${target.serviceSlug}@${target.environmentSlug}`,
    };
    const settings = await this.pushEffect(orgId, effect);

    await this.audit.log({
      organizationId: orgId,
      actorId,
      action: 'simulation.scenario_run',
      entityType: 'deployment',
      entityId: dep.id,
      metadata: { scenarioKey: scenario.key },
    });

    this.emit(orgId, settings);
    return {
      simulationMode: true,
      framing: 'Local simulation only — no real production impact.',
      effect,
      deployment: await this.deployments.get(orgId, dep.id),
      settings: this.serializeSettings(settings),
    };
  }

  private async runRollback(
    orgId: string,
    actorId: string,
    scenario: ScenarioDef,
    target: {
      serviceId: string;
      environmentId: string;
      serviceSlug: string;
      environmentSlug: string;
    },
  ) {
    let deployment = await this.prisma.deployment.findFirst({
      where: {
        organizationId: orgId,
        serviceId: target.serviceId,
        environmentId: target.environmentId,
        status: {
          in: [DeploymentStatus.failed, DeploymentStatus.rollback_required],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!deployment) {
      const created = await this.runDeploymentFailure(
        orgId,
        actorId,
        OrgRole.admin,
        scenario,
        target,
      );
      deployment = await this.prisma.deployment.findFirstOrThrow({
        where: { id: created.deployment.id },
      });
    }

    const rollback = await this.rollbacks.start(orgId, deployment.id, actorId);
    const effect: SimulationEffect = {
      id: randomUUID(),
      scenarioKey: scenario.key,
      label: scenario.label,
      serviceId: target.serviceId,
      environmentId: target.environmentId,
      deploymentId: deployment.id,
      startedAt: new Date().toISOString(),
      note: `Rollback ${deployment.id}`,
    };
    const settings = await this.pushEffect(orgId, effect);
    this.emit(orgId, settings);

    return {
      simulationMode: true,
      framing: 'Local simulation only — no real production impact.',
      effect,
      rollback,
      settings: this.serializeSettings(settings),
    };
  }

  private async resolveTarget(
    orgId: string,
    scenario: ScenarioDef,
    dto: RunScenarioDto,
  ) {
    const service =
      (dto.serviceId
        ? await this.prisma.service.findFirst({
            where: { id: dto.serviceId, organizationId: orgId },
          })
        : null) ??
      (await this.prisma.service.findFirst({
        where: {
          organizationId: orgId,
          slug: dto.serviceSlug ?? scenario.defaultServiceSlug,
        },
      }));
    if (!service) {
      throw new NotFoundException('Target service not found');
    }

    const environment =
      (dto.environmentId
        ? await this.prisma.environment.findFirst({
            where: { id: dto.environmentId, organizationId: orgId },
          })
        : null) ??
      (await this.prisma.environment.findFirst({
        where: {
          organizationId: orgId,
          slug: dto.environmentSlug ?? scenario.defaultEnvironmentSlug,
        },
      }));
    if (!environment) {
      throw new NotFoundException('Target environment not found');
    }

    return {
      serviceId: service.id,
      environmentId: environment.id,
      serviceSlug: service.slug,
      environmentSlug: environment.slug,
    };
  }

  private async ensureSettings(orgId: string) {
    const existing = await this.prisma.simulationSettings.findUnique({
      where: { organizationId: orgId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.simulationSettings.create({
      data: {
        organizationId: orgId,
        simulationMode: true,
        buildFailRate: Number(process.env.SIM_BUILD_FAIL_RATE ?? 0),
        deployFailRate: Number(process.env.SIM_DEPLOY_FAIL_RATE ?? 0),
        healthFailRate: Number(process.env.SIM_HEALTH_FAIL_RATE ?? 0),
        stageDelayMs: Number(process.env.SIM_STAGE_DELAY_MS ?? 400),
        deterministic: process.env.SIM_DETERMINISTIC === 'true',
        activeEffects: [],
      },
    });
  }

  private async pushEffect(orgId: string, effect: SimulationEffect) {
    const settings = await this.ensureSettings(orgId);
    const effects = this.readEffects(settings.activeEffects);
    effects.push(effect);
    return this.prisma.simulationSettings.update({
      where: { organizationId: orgId },
      data: { activeEffects: effects },
    });
  }

  private readEffects(raw: Prisma.JsonValue): SimulationEffect[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw as unknown as SimulationEffect[];
  }

  private serializeSettings(
    settings: Awaited<ReturnType<SimulationService['ensureSettings']>>,
  ) {
    return {
      simulationMode: true as const,
      framing:
        'Local simulation only — FlowOps does not deploy to or mutate real production infrastructure.',
      buildFailRate: settings.buildFailRate,
      deployFailRate: settings.deployFailRate,
      healthFailRate: settings.healthFailRate,
      stageDelayMs: settings.stageDelayMs,
      deterministic: settings.deterministic,
      activeEffects: this.readEffects(settings.activeEffects),
      updatedAt: settings.updatedAt,
    };
  }

  private emit(
    orgId: string,
    settings: Awaited<ReturnType<SimulationService['ensureSettings']>>,
  ) {
    this.realtime.emitToOrg(orgId, REALTIME_EVENTS.SIMULATION_UPDATED, {
      simulationMode: true,
      activeEffects: this.readEffects(settings.activeEffects),
      buildFailRate: settings.buildFailRate,
      deployFailRate: settings.deployFailRate,
      healthFailRate: settings.healthFailRate,
      stageDelayMs: settings.stageDelayMs,
    });
  }
}
