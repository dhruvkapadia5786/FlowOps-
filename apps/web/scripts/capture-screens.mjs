import { chromium } from '@playwright/test';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const out = join(repoRoot, 'docs', 'screenshots');
const base = process.env.FLOWOPS_WEB_URL ?? 'http://127.0.0.1:43125';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
await page.screenshot({ path: join(out, '01-login.png'), fullPage: false });

await page.locator('input[type="email"], input[name="email"]').first().fill('maya.chen@northstar.io');
await page.locator('input[type="password"]').first().fill('FlowOps!demo1');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(4000);
await page.screenshot({ path: join(out, '02-dashboard.png'), fullPage: false });

await page.goto(`${base}/deployments`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(out, '03-deployments.png'), fullPage: false });

await page.goto(`${base}/incidents`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(out, '04-ops.png'), fullPage: false });

await browser.close();
console.log('wrote shots to', out);
