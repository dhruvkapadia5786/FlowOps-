import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const API = process.env.FLOWOPS_API_URL ?? 'http://127.0.0.1:43124/api/v1';
const EMAIL = 'maya.chen@northstar.io';
const PASSWORD = 'FlowOps!demo1';

async function loginUi(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText('Operations overview')).toBeVisible({ timeout: 20_000 });
}

async function apiAuth(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(login.ok()).toBeTruthy();
  let accessToken = (await login.json()).accessToken as string;

  const me = await request.get(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await me.json();
  const orgId = body.memberships[0].organization.id as string;

  const select = await request.post(`${API}/orgs/${orgId}/select`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  accessToken = (await select.json()).accessToken as string;
  return { accessToken, orgId };
}

async function waitForDeploymentStatus(
  request: APIRequestContext,
  accessToken: string,
  orgId: string,
  id: string,
  wanted: string[],
  attempts = 50,
) {
  for (let i = 0; i < attempts; i++) {
    const res = await request.get(`${API}/deployments/${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Org-Id': orgId,
      },
    });
    const data = await res.json();
    if (wanted.includes(data.status)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Deployment ${id} never reached ${wanted.join('|')}`);
}

test.describe('FlowOps happy path', () => {
  test('login → dashboard → deploy → approval → success', async ({ page, request }) => {
    await loginUi(page);
    await expect(page.getByText('Simulation mode').first()).toBeVisible();
    await expect(page.getByText('Status distribution')).toBeVisible();

    const { accessToken, orgId } = await apiAuth(request);
    const services = await request.get(`${API}/services?pageSize=20`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Org-Id': orgId },
    });
    const serviceId = (await services.json()).data[0].id as string;
    const envs = await request.get(`${API}/environments`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Org-Id': orgId },
    });
    const envList = (await envs.json()) as Array<{
      id: string;
      slug: string;
      requiresApproval: boolean;
    }>;
    const prod = envList.find((e) => e.requiresApproval || e.slug === 'prod')!;
    const version = `pw-prod-${Date.now()}`;

    const created = await request.post(`${API}/deployments`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Org-Id': orgId },
      data: {
        serviceId,
        environmentId: prod.id,
        version,
        commitSha: 'pwcommit',
      },
    });
    expect(created.ok()).toBeTruthy();
    const deploymentId = (await created.json()).id as string;

    await waitForDeploymentStatus(request, accessToken, orgId, deploymentId, [
      'waiting_for_approval',
    ]);

    await page.goto('/approvals');
    await expect(page.getByText('Approval inbox')).toBeVisible();
    const statusSelect = page.locator('select[name="status"]');
    if (await statusSelect.count()) {
      await statusSelect.selectOption('pending');
    }

    const row = page.locator('tr', { hasText: version });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole('button', { name: 'Approve' }).click();
    // Confirm dialog
    await page.locator('fo-confirm-dialog').getByRole('button', { name: 'Approve' }).click();

    await waitForDeploymentStatus(request, accessToken, orgId, deploymentId, [
      'success',
    ]);

    await page.goto(`/deployments/${deploymentId}`);
    await expect(page.getByText(/success/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('fo-pipeline')).toBeVisible();
  });
});

test.describe('FlowOps failure path', () => {
  test('failure → incident → rollback', async ({ page, request }) => {
    await loginUi(page);

    const { accessToken, orgId } = await apiAuth(request);
    const sim = await request.post(
      `${API}/simulation/scenarios/deployment_failure/run`,
      {
        headers: { Authorization: `Bearer ${accessToken}`, 'X-Org-Id': orgId },
        data: {},
      },
    );
    expect(sim.ok()).toBeTruthy();
    const simBody = await sim.json();
    const deploymentId =
      (simBody.deployment?.id as string) ||
      (simBody.effect?.deploymentId as string);
    expect(deploymentId).toBeTruthy();

    await page.goto('/incidents');
    await expect(page.getByText(/incident/i).first()).toBeVisible();

    await page.goto(`/deployments/${deploymentId}`);
    await expect(page.getByText(/failed|rollback/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const rollback = page.getByRole('button', { name: /^Rollback$/i });
    await expect(rollback).toBeVisible({ timeout: 15_000 });
    await rollback.click();
    await page.getByRole('button', { name: 'Start rollback' }).click();

    await waitForDeploymentStatus(
      request,
      accessToken,
      orgId,
      deploymentId,
      ['rolled_back'],
      50,
    );

    await page.reload();
    await expect(page.getByText(/rolled.?back/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('FlowOps shell enrichment', () => {
  test('dashboard charts, reports, and theme toggle', async ({ page }) => {
    await loginUi(page);
    await expect(page.getByText('Status distribution')).toBeVisible();
    await expect(page.getByText('Outcome mix')).toBeVisible();

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Reports' }).click();
    await expect(page.getByText('Ops reports')).toBeVisible();
    await expect(page.getByRole('button', { name: /excel/i }).first()).toBeVisible();

    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Architecture' }).click();
    await expect(page.getByText('Platform architecture')).toBeVisible();
    await expect(page.locator('.topo')).toBeVisible();

    await page.getByRole('button', { name: /theme/i }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', /flowops/);
  });
});
