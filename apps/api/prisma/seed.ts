import {
  DeploymentStatus,
  HealthProbeStatus,
  HealthProbeType,
  IncidentSeverity,
  IncidentStatus,
  OrgRole,
  PrismaClient,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const SERVICES = [
  {
    name: 'Payments API',
    slug: 'payments-api',
    description: 'Card capture and settlement',
    repositoryUrl: 'https://github.com/northstar/payments-api',
  },
  {
    name: 'Checkout Web',
    slug: 'checkout-web',
    description: 'Storefront checkout experience',
    repositoryUrl: 'https://github.com/northstar/checkout-web',
  },
  {
    name: 'Inventory Worker',
    slug: 'inventory-worker',
    description: 'Stock reservation and sync',
    repositoryUrl: 'https://github.com/northstar/inventory-worker',
  },
  {
    name: 'Identity Service',
    slug: 'identity-service',
    description: 'Customer identity and sessions',
    repositoryUrl: 'https://github.com/northstar/identity-service',
  },
  {
    name: 'Order Orchestrator',
    slug: 'order-orchestrator',
    description: 'Order lifecycle coordination',
    repositoryUrl: 'https://github.com/northstar/order-orchestrator',
  },
  {
    name: 'Catalog API',
    slug: 'catalog-api',
    description: 'Product catalog reads',
    repositoryUrl: 'https://github.com/northstar/catalog-api',
  },
  {
    name: 'Shipping Adapter',
    slug: 'shipping-adapter',
    description: 'Carrier integrations',
    repositoryUrl: 'https://github.com/northstar/shipping-adapter',
  },
  {
    name: 'Notifications Gateway',
    slug: 'notifications-gateway',
    description: 'Email and push fan-out',
    repositoryUrl: 'https://github.com/northstar/notifications-gateway',
  },
  {
    name: 'Pricing Engine',
    slug: 'pricing-engine',
    description: 'Promotions and price calculation',
    repositoryUrl: 'https://github.com/northstar/pricing-engine',
  },
  {
    name: 'Fraud Guard',
    slug: 'fraud-guard',
    description: 'Realtime fraud scoring',
    repositoryUrl: 'https://github.com/northstar/fraud-guard',
  },
] as const;

/** M3 seed: auth users + 10 services + 4 envs + sample historical deployments */
async function main() {
  const passwordHash = await argon2.hash('FlowOps!demo1');

  const maya = await prisma.user.upsert({
    where: { email: 'maya.chen@northstar.io' },
    update: {},
    create: {
      email: 'maya.chen@northstar.io',
      fullName: 'Maya Chen',
      passwordHash,
    },
  });

  const jordan = await prisma.user.upsert({
    where: { email: 'jordan.blake@northstar.io' },
    update: {},
    create: {
      email: 'jordan.blake@northstar.io',
      fullName: 'Jordan Blake',
      passwordHash,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'northstar-commerce' },
    update: {},
    create: {
      name: 'Northstar Commerce',
      slug: 'northstar-commerce',
    },
  });

  await prisma.simulationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      simulationMode: true,
      buildFailRate: 0,
      deployFailRate: 0,
      healthFailRate: 0,
      stageDelayMs: 400,
      deterministic: false,
      activeEffects: [],
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: maya.id },
    },
    update: { role: OrgRole.admin },
    create: {
      organizationId: org.id,
      userId: maya.id,
      role: OrgRole.admin,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: jordan.id },
    },
    update: { role: OrgRole.devops },
    create: {
      organizationId: org.id,
      userId: jordan.id,
      role: OrgRole.devops,
    },
  });

  const avery = await prisma.user.upsert({
    where: { email: 'avery.kim@northstar.io' },
    update: {},
    create: {
      email: 'avery.kim@northstar.io',
      fullName: 'Avery Kim',
      passwordHash,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: avery.id },
    },
    update: { role: OrgRole.release_manager },
    create: {
      organizationId: org.id,
      userId: avery.id,
      role: OrgRole.release_manager,
    },
  });

  const envDefs = [
    { name: 'Development', slug: 'dev', requiresApproval: false, sortOrder: 1 },
    { name: 'QA', slug: 'qa', requiresApproval: false, sortOrder: 2 },
    { name: 'UAT', slug: 'uat', requiresApproval: false, sortOrder: 3 },
    { name: 'Production', slug: 'prod', requiresApproval: true, sortOrder: 4 },
  ];

  const environments = [];
  for (const env of envDefs) {
    const row = await prisma.environment.upsert({
      where: {
        organizationId_slug: { organizationId: org.id, slug: env.slug },
      },
      update: {
        requiresApproval: env.requiresApproval,
        sortOrder: env.sortOrder,
      },
      create: {
        organizationId: org.id,
        ...env,
        healthCheckConfig: { create: {} },
      },
    });
    environments.push(row);
  }

  const services = [];
  for (const svc of SERVICES) {
    const row = await prisma.service.upsert({
      where: {
        organizationId_slug: { organizationId: org.id, slug: svc.slug },
      },
      update: {
        name: svc.name,
        description: svc.description,
        repositoryUrl: svc.repositoryUrl,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        ...svc,
      },
    });
    services.push(row);
  }

  // Historical deployments for list UI (not processed by workers)
  const existingCount = await prisma.deployment.count({
    where: { organizationId: org.id },
  });
  if (existingCount < 12) {
    const statuses: DeploymentStatus[] = [
      DeploymentStatus.success,
      DeploymentStatus.success,
      DeploymentStatus.failed,
      DeploymentStatus.success,
      DeploymentStatus.waiting_for_approval,
      DeploymentStatus.success,
    ];
    let created = 0;
    for (let i = 0; i < 12 - existingCount; i++) {
      const service = services[i % services.length];
      const environment = environments[i % environments.length];
      const status = statuses[i % statuses.length];
      const deployment = await prisma.deployment.create({
        data: {
          organizationId: org.id,
          serviceId: service.id,
          environmentId: environment.id,
          triggeredById: i % 2 === 0 ? jordan.id : maya.id,
          version: `1.${i}.0`,
          commitSha: `seed${i.toString(16).padStart(7, '0')}`,
          status,
          startedAt: new Date(Date.now() - (i + 1) * 3600_000),
          finishedAt:
            status === DeploymentStatus.success ||
            status === DeploymentStatus.failed
              ? new Date(Date.now() - i * 3600_000)
              : null,
          failureReason:
            status === DeploymentStatus.failed
              ? 'Seeded historical failure'
              : null,
          events: {
            create: [
              {
                fromStatus: null,
                toStatus: DeploymentStatus.queued,
                message: 'Seeded deployment',
              },
              {
                fromStatus: DeploymentStatus.queued,
                toStatus: status,
                message: `Seeded terminal/current status ${status}`,
              },
            ],
          },
        },
      });
      created += 1;
      if (status === DeploymentStatus.waiting_for_approval) {
        await prisma.approval.upsert({
          where: { deploymentId: deployment.id },
          update: {},
          create: {
            deploymentId: deployment.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
    }
    console.log(`  historical deployments created: ${created}`);
  }

  // Ensure health configs exist with M5 thresholds
  for (const env of environments) {
    await prisma.healthCheckConfig.upsert({
      where: { environmentId: env.id },
      update: {
        failureThreshold: 3,
        latencyThresholdMs: env.slug === 'prod' ? 400 : 600,
      },
      create: {
        environmentId: env.id,
        failureThreshold: 3,
        latencyThresholdMs: env.slug === 'prod' ? 400 : 600,
      },
    });
  }

  // Seed health snapshots for a few service×env pairs
  for (let i = 0; i < 8; i++) {
    const service = services[i % services.length];
    const environment = environments[i % environments.length];
    const unhealthy = i % 5 === 0;
    await prisma.serviceHealthSnapshot.upsert({
      where: {
        serviceId_environmentId: {
          serviceId: service.id,
          environmentId: environment.id,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        serviceId: service.id,
        environmentId: environment.id,
        overallStatus: unhealthy
          ? HealthProbeStatus.unhealthy
          : HealthProbeStatus.healthy,
        uptimePercent: unhealthy ? 97.2 : 99.7,
        avgLatencyMs: unhealthy ? 620 : 45 + i * 3,
        consecutiveFailures: unhealthy ? 3 : 0,
        probes: {
          create: [
            HealthProbeType.api,
            HealthProbeType.db,
            HealthProbeType.redis,
            HealthProbeType.queue,
            HealthProbeType.external,
          ].map((probeType, idx) => ({
            probeType,
            status:
              unhealthy && idx === 0
                ? HealthProbeStatus.unhealthy
                : HealthProbeStatus.healthy,
            latencyMs: unhealthy && idx === 0 ? 800 : 20 + idx * 10,
            message: unhealthy && idx === 0 ? 'Seeded probe failure' : 'OK',
          })),
        },
      },
    });
  }

  // Seed ≥20 incidents with timelines
  const incidentCount = await prisma.incident.count({
    where: { organizationId: org.id },
  });
  if (incidentCount < 20) {
    const severities = [
      IncidentSeverity.sev1,
      IncidentSeverity.sev2,
      IncidentSeverity.sev3,
      IncidentSeverity.sev4,
    ];
    const statuses = [
      IncidentStatus.open,
      IncidentStatus.investigating,
      IncidentStatus.mitigated,
      IncidentStatus.resolved,
    ];
    const sources = [
      'deployment_failure',
      'deployment_health_failure',
      'health_latency',
      'health_repeated_failures',
      'health_unavailability',
      'manual',
    ];
    const failedDeploys = await prisma.deployment.findMany({
      where: { organizationId: org.id, status: DeploymentStatus.failed },
      take: 5,
    });
    let made = 0;
    for (let i = 0; i < 20 - incidentCount; i++) {
      const service = services[i % services.length];
      const environment = environments[i % environments.length];
      const status = statuses[i % statuses.length];
      const linkedDeploy =
        i < failedDeploys.length ? failedDeploys[i] : null;
      try {
        await prisma.incident.create({
          data: {
            organizationId: org.id,
            serviceId: service.id,
            environmentId: environment.id,
            deploymentId: linkedDeploy?.id,
            title:
              linkedDeploy != null
                ? `Deploy failed: ${service.slug}@${linkedDeploy.version} → ${environment.slug}`
                : `Ops signal: ${service.slug} @ ${environment.slug} (${sources[i % sources.length]})`,
            description:
              linkedDeploy != null
                ? linkedDeploy.failureReason ?? 'Seeded deploy failure'
                : 'Seeded health/ops incident for portfolio demo',
            severity: severities[i % severities.length],
            status,
            source: linkedDeploy != null ? 'deployment_failure' : sources[i % sources.length],
            assigneeId: i % 3 === 0 ? jordan.id : i % 3 === 1 ? avery.id : null,
            resolvedAt:
              status === IncidentStatus.resolved
                ? new Date(Date.now() - i * 1800_000)
                : null,
            openedAt: new Date(Date.now() - (i + 2) * 3600_000),
            events: {
              create: [
                {
                  fromStatus: null,
                  toStatus: IncidentStatus.open,
                  message: 'Incident opened (seed)',
                  actorId: maya.id,
                },
                ...(status !== IncidentStatus.open
                  ? [
                      {
                        fromStatus: IncidentStatus.open,
                        toStatus: status,
                        message: `Moved to ${status} (seed)`,
                        actorId: jordan.id,
                      },
                    ]
                  : []),
              ],
            },
          },
        });
        made += 1;
      } catch {
        // skip unique deployment conflicts
      }
    }
    console.log(`  incidents created: ${made}`);
  }

  const totalIncidents = await prisma.incident.count({
    where: { organizationId: org.id },
  });

  console.log('Seeded M5 data:');
  console.log(`  org: ${org.slug} (${org.id})`);
  console.log(`  services: ${services.length}`);
  console.log(`  environments: ${environments.map((e) => e.slug).join(', ')}`);
  console.log(`  incidents: ${totalIncidents}`);
  console.log(`  admin: ${maya.email} / FlowOps!demo1`);
  console.log(`  devops: ${jordan.email} / FlowOps!demo1`);
  console.log(`  release_manager: ${avery.email} / FlowOps!demo1`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
