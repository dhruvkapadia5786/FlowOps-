# FlowOps

**Production Deployment & Incident Intelligence Platform** — a portfolio flagship that models how engineering teams ship, approve, observe, and recover from deployments.

> Simulation-first: FlowOps does **not** deploy to real infrastructure. Builds, health checks, and rollbacks run locally via BullMQ workers so the full product is demoable with Docker Compose.

---

## Quick start (Docker Compose)

One command brings up Postgres, Redis, API, worker, seed data, and the Angular UI:

```bash
docker compose up --build
# or (handles nested-Docker bridge quirks automatically):
./scripts/compose-up.sh
```

| Surface | URL |
|---------|-----|
| Web | [http://127.0.0.1:43125](http://127.0.0.1:43125) |
| API | [http://127.0.0.1:43124/api/v1](http://127.0.0.1:43124/api/v1) |

Login: `maya.chen@northstar.io` / `FlowOps!demo1`

Optional secrets: copy `.env.example` → `.env` before `compose up`.

Stop: `docker compose down` (add `-v` to wipe the Postgres volume).

**Ports:** Compose keeps Postgres/Redis on the internal network only (no host publish) so they do not clash with local `5432`/`6379`. API publishes `43124`, web publishes `43125`.

---

## Why FlowOps?

Recruiters scanning GitHub should conclude: *this developer can independently design and build a production-grade system.*

FlowOps packages the hard parts of a DevOps control plane into one coherent product:

- Deployment lifecycle with failure and rollback paths  
- Production approvals with audit trails  
- Auto-created incidents tied to failed releases  
- Real-time WebSocket updates  
- RBAC across Admin, DevOps, Developer, Release Manager, and Viewer  

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Angular 20 · Tailwind 4 · DaisyUI · Angular CDK (`apps/web`) |
| API | NestJS 11 modular monolith (`apps/api`) |
| ORM / DB | Prisma 5 · PostgreSQL 16 |
| Jobs / realtime fabric | Redis · BullMQ · Socket.IO `/ws` |
| Delivery | Docker Compose · GitHub Actions |
| Tests | Jest (API) · Karma/Jasmine (web) · Playwright E2E |

---

## Current status

| Milestone | Focus | Status |
|-----------|-------|--------|
| **M1–M12** | Design through Docker/CI | Done |
| **M13** | Perf / security review + hardening | **Done (this branch)** |
| M14 | Portfolio polish | Not started |

---

## Design documentation

| Document | Contents |
|----------|----------|
| [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | Problem, personas, modules, flows, seed requirements |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System context, Nest modules, state machine, ADRs |
| [docs/DATABASE_DESIGN.md](./docs/DATABASE_DESIGN.md) | Normalized PostgreSQL schema, indexes, FKs, Mermaid ERD |
| [docs/API_SPEC.md](./docs/API_SPEC.md) | REST + WebSocket contracts and RBAC matrix |
| [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | Milestones M1–M14 with exit criteria |
| [SECURITY.md](./SECURITY.md) | Security checklist and operational notes |

---

## Local development (without Compose)

### API

Requires PostgreSQL **and Redis**. From `apps/api`:

```bash
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
# optional discrete worker: npm run start:worker
```

API: [http://127.0.0.1:43124/api/v1](http://127.0.0.1:43124/api/v1)

### Web

```bash
cd apps/web
npm install
npm start
```

Web: [http://127.0.0.1:43125](http://127.0.0.1:43125)

### Seed accounts

| Email | Password | Role |
|-------|----------|------|
| `maya.chen@northstar.io` | `FlowOps!demo1` | admin |
| `jordan.blake@northstar.io` | `FlowOps!demo1` | devops |
| `avery.kim@northstar.io` | `FlowOps!demo1` | release_manager |

```bash
curl -s -X POST http://127.0.0.1:43124/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"maya.chen@northstar.io","password":"FlowOps!demo1"}'
```

---

## Tests

```bash
# API unit/integration
cd apps/api && npm test
cd apps/api && npm test -- --coverage

# Live API e2e (API + Postgres + Redis running)
cd apps/api && RUN_E2E=1 npm run test:e2e

# Web unit + Playwright (web + API running)
cd apps/web && npm test
cd apps/web && npm run test:e2e
```

---

## CI / CD (GitHub Actions)

| Workflow | What it does |
|----------|----------------|
| `.github/workflows/ci.yml` | Install · lint · unit test · build for API & web |
| `.github/workflows/cd-simulate.yml` | Build/tag Docker images and upload `.tar.gz` artifacts (no paid registry) |

---

## Deployment lifecycle

```
QUEUED → BUILDING → TESTING → WAITING_FOR_APPROVAL → DEPLOYING → HEALTH_CHECK → SUCCESS
```

Failure / rollback:

```
BUILDING → FAILED
DEPLOYING|HEALTH_CHECK → FAILED → ROLLBACK_REQUIRED → ROLLING_BACK → ROLLED_BACK
```

---

## Roadmap snapshot

1–12. Design through Docker/CI ✓  
13. **M13** Perf / security ✓  
14. M14 Portfolio polish  

Details: [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)

---

## License

MIT (planned) — to be confirmed when the repository is published.
