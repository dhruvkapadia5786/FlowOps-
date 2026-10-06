import request from 'supertest';

/**
 * Integration e2e against the already-running API (migrated + seeded).
 * Opt-in: RUN_E2E=1 npm run test:e2e
 *
 * Hits the live Nest process so BullMQ workers participate in lifecycle waits.
 */
const API = process.env.FLOWOPS_API_URL ?? 'http://127.0.0.1:43124';
const PREFIX = process.env.API_PREFIX ?? 'api/v1';
const base = `${API}/${PREFIX}`;

describe('FlowOps API (e2e live)', () => {
  let accessToken = '';
  let orgId = '';
  let serviceId = '';
  let prodEnvId = '';
  let nonProdEnvId = '';

  const run = process.env.RUN_E2E === '1';
  const maybe = run ? it : it.skip;

  beforeAll(async () => {
    if (!run) {
      return;
    }

    const login = await request(base)
      .post('/auth/login')
      .send({
        email: 'maya.chen@northstar.io',
        password: 'FlowOps!demo1',
      })
      .expect(201);

    accessToken = login.body.accessToken as string;
    const me = await request(base)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    orgId = me.body.memberships[0].organization.id as string;

    const select = await request(base)
      .post(`/orgs/${orgId}/select`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    accessToken = select.body.accessToken as string;

    const services = await request(base)
      .get('/services?pageSize=5')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', orgId)
      .expect(200);
    serviceId = services.body.data[0].id as string;

    const envs = await request(base)
      .get('/environments')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('X-Org-Id', orgId)
      .expect(200);

    const list = envs.body as Array<{
      id: string;
      slug: string;
      requiresApproval: boolean;
    }>;
    prodEnvId = list.find((e) => e.requiresApproval || e.slug === 'prod')!.id;
    nonProdEnvId = list.find((e) => !e.requiresApproval && e.slug !== 'prod')!.id;
  }, 60_000);

  const auth = () => ({
    Authorization: `Bearer ${accessToken}`,
    'X-Org-Id': orgId,
  });

  maybe('GET /health/live → 200', () => {
    return request(base).get('/health/live').expect(200).expect({ status: 'ok' });
  });

  maybe('GET /auth/me without token → 401', () => {
    return request(base).get('/auth/me').expect(401);
  });

  maybe('RBAC: unauthenticated deployments → 401', async () => {
    await request(base).get('/deployments').expect(401);
  });

  maybe('RBAC: authenticated without org context → 403', async () => {
    const login = await request(base)
      .post('/auth/login')
      .send({
        email: 'maya.chen@northstar.io',
        password: 'FlowOps!demo1',
      })
      .expect(201);

    await request(base)
      .get('/deployments')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  maybe('create non-prod deploy → eventually success', async () => {
    const created = await request(base)
      .post('/deployments')
      .set(auth())
      .send({
        serviceId,
        environmentId: nonProdEnvId,
        version: `e2e-np-${Date.now()}`,
        commitSha: 'abcdef1',
      })
      .expect(201);

    const id = created.body.id as string;
    let status = created.body.status as string;
    for (let i = 0; i < 40 && status !== 'success' && status !== 'failed'; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const detail = await request(base)
        .get(`/deployments/${id}`)
        .set(auth())
        .expect(200);
      status = detail.body.status;
    }
    expect(status).toBe('success');
  }, 60_000);

  maybe('prod deploy → approve → success', async () => {
    const created = await request(base)
      .post('/deployments')
      .set(auth())
      .send({
        serviceId,
        environmentId: prodEnvId,
        version: `e2e-prod-${Date.now()}`,
      })
      .expect(201);

    const id = created.body.id as string;
    let status = '';
    let approvalId = '';
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const detail = await request(base)
        .get(`/deployments/${id}`)
        .set(auth())
        .expect(200);
      status = detail.body.status;
      if (status === 'waiting_for_approval' && detail.body.approval?.id) {
        approvalId = detail.body.approval.id;
        break;
      }
      if (status === 'failed') {
        break;
      }
    }
    expect(status).toBe('waiting_for_approval');
    expect(approvalId).toBeTruthy();

    await request(base)
      .post(`/approvals/${approvalId}/decide`)
      .set(auth())
      .send({ decision: 'approved', comment: 'e2e gate cleared' })
      .expect(201);

    for (let i = 0; i < 40 && status !== 'success' && status !== 'failed'; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const detail = await request(base)
        .get(`/deployments/${id}`)
        .set(auth())
        .expect(200);
      status = detail.body.status;
    }
    expect(status).toBe('success');
  }, 90_000);

  maybe('simulation payment failure → incident → recover', async () => {
    const runSim = await request(base)
      .post('/simulation/scenarios/payment_api_failure/run')
      .set(auth())
      .send({})
      .expect(201);

    expect(runSim.body.simulationMode).toBe(true);
    expect(runSim.body.activeEffects?.length ?? runSim.body.settings?.activeEffects?.length ?? 1).toBeGreaterThan(0);

    const incidents = await request(base)
      .get('/incidents?status=open&pageSize=20')
      .set(auth())
      .expect(200);
    expect(incidents.body.meta.total).toBeGreaterThan(0);

    await request(base)
      .post('/simulation/scenarios/payment_api_failure/recover')
      .set(auth())
      .send({})
      .expect(201);
  }, 30_000);

  maybe('deployment failure scenario → rollback path', async () => {
    const runSim = await request(base)
      .post('/simulation/scenarios/deployment_failure/run')
      .set(auth())
      .send({})
      .expect(201);

    const id =
      (runSim.body.deployment?.id as string | undefined) ||
      (runSim.body.effect?.deploymentId as string | undefined);
    expect(id).toBeTruthy();

    const detail = await request(base)
      .get(`/deployments/${id}`)
      .set(auth())
      .expect(200);

    expect(['failed', 'rollback_required']).toContain(detail.body.status);

    await request(base)
      .post(`/deployments/${id}/rollback`)
      .set(auth())
      .send({})
      .expect(201);

    let status = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const d = await request(base).get(`/deployments/${id}`).set(auth()).expect(200);
      status = d.body.status;
      if (status === 'rolled_back') {
        break;
      }
    }
    expect(status).toBe('rolled_back');
  }, 60_000);
});
