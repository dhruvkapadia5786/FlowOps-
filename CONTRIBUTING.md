# Contributing to FlowOps

Thanks for taking an interest. FlowOps is a **portfolio flagship** — contributions should keep the product demoable, simulation-honest, and recruiter-readable.

## Ground rules

1. **Simulation-first** — do not wire real cloud deploys without an explicit, off-by-default adapter and docs that say so.  
2. **No secrets in git** — use `.env.example` only; JWT secrets must be ≥ 32 characters.  
3. **Conventional commits** — `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`, `ci:`.  
4. **Thin controllers / solid modules** — Nest domain modules stay cohesive; Angular features stay lazy-loaded.  
5. **Preserve seed realism** — no “lorem” / “Test User” in user-facing copy or seed data.

## Prerequisites

- Node.js **22+**
- Docker + Docker Compose (for the one-command path)
- PostgreSQL 16 + Redis 7 if running API outside Compose

## One-command demo

```bash
cp .env.example .env
docker compose up --build
# Web http://127.0.0.1:43125 · API http://127.0.0.1:43124/api/v1
# maya.chen@northstar.io / FlowOps!demo1
```

## Local split (API + web)

```bash
# API
cd apps/api && cp .env.example .env && npm ci
npx prisma migrate deploy && npx prisma db seed
npm run start:dev
# optional: npm run start:worker

# Web (other terminal)
cd apps/web && npm ci && npm start
```

## Checks before opening a PR

```bash
cd apps/api && npm run lint && npm test && npm run build
cd apps/web && npm test && npm run build
```

Optional:

```bash
cd apps/api && RUN_E2E=1 npm run test:e2e   # API + DB + Redis up
cd apps/web && npm run test:e2e             # Playwright; web + API up
```

## Pull requests

Use the [PR template](./.github/PULL_REQUEST_TEMPLATE.md). Keep PRs focused (one concern). Update docs when behavior or env vars change.

## Issue reports

Use the [bug](./.github/ISSUE_TEMPLATE/bug_report.md) or [feature](./.github/ISSUE_TEMPLATE/feature_request.md) templates. Include reproduce steps and whether you used Compose or local npm.

## Security

See [SECURITY.md](./SECURITY.md). Do not file public issues for credential leaks in forks — rotate secrets and open a private note to the maintainer when a public repo exists.

## Code map

| Path | Role |
|------|------|
| `apps/api` | NestJS API + worker entry |
| `apps/web` | Angular SPA |
| `docs/` | Product / architecture / DB / API / plan |
| `docker-compose.yml` | Full stack demo |
| `.github/workflows/` | CI + CD simulation |
