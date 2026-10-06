# FlowOps

**Production Deployment & Incident Intelligence Platform** — a portfolio flagship that models how engineering teams ship, approve, observe, and recover from deployments.

> Simulation-first: FlowOps does **not** deploy to real infrastructure. Builds, health checks, and rollbacks run locally via BullMQ workers so the full product is demoable with Docker Compose.

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
| Frontend | Angular 20+ (planned M7) |
| API | NestJS 11 modular monolith (`apps/api`) |
| ORM / DB | Prisma 5 · PostgreSQL 16 |
| Jobs / realtime fabric | Redis + BullMQ + WebSockets (later milestones) |
| Delivery | Docker Compose · GitHub Actions (M12) |
| Tests | Jest · Playwright |

---

## Current status

| Milestone | Focus | Status |
|-----------|-------|--------|
| **M1** | Architecture · product spec · database design · API spec · plan | Done |
| **M2** | NestJS foundation · Prisma · JWT auth · RBAC · orgs · health | Done |
| **M3** | Services · environments · deployments · BullMQ simulation | Done |
| **M4** | Approvals · expiration · rollback simulation | Done |
| **M5** | Health probes · incidents · auto-correlation | Done |
| **M6** | WebSockets · live events · notifications | **Done (this branch)** |
| M7–M14 | Angular UI through portfolio polish | Not started |

---

## Design documentation

| Document | Contents |
|----------|----------|
| [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | Problem, personas, modules, flows, seed requirements |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System context, Nest modules, state machine, ADRs |
| [docs/DATABASE_DESIGN.md](./docs/DATABASE_DESIGN.md) | Normalized PostgreSQL schema, indexes, FKs, Mermaid ERD |
| [docs/API_SPEC.md](./docs/API_SPEC.md) | REST + WebSocket contracts and RBAC matrix |
| [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) | Milestones M1–M14 with exit criteria |

---

## Run the API (M2)

Requires PostgreSQL **and Redis**. From `apps/api`:

```bash
cp .env.example .env
# set DATABASE_URL / REDIS_URL if needed
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

API: [http://127.0.0.1:43124/api/v1](http://127.0.0.1:43124/api/v1)

| Endpoint | Notes |
|----------|--------|
| `GET /health/live` | Liveness |
| `GET /health/ready` | Postgres + Redis readiness |
| `POST /auth/login` | Seed accounts below |
| `GET /services` | Requires Bearer + org context (`X-Org-Id` or select) |
| `GET /environments` | Dev / QA / UAT / Prod |
| `POST /deployments` | Enqueues BullMQ simulated pipeline |
| `POST /approvals/:id/decide` | Release Manager / Admin approve or reject |
| `POST /deployments/:id/rollback` | Simulated rollback to prior success |
| `GET /incidents` | Incident list (seed ≥20) |
| `POST /service-health/run` | Run simulated probes (api/db/redis/queue/external) |

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

```bash
cd apps/api && npm test && npm run build
```

**After M12:** `docker compose up --build` (planned).

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

1. M1 Design docs ✓  
2. M2 NestJS + auth + database ✓  
3. M3 Services + environments + deployments ✓  
4. M4 Approvals + rollback ✓  
5. M5 Health + incidents ✓  
6. **M6** WebSockets  
7. M7–M9 Angular UI  
8. M10–M14 Simulation, tests, Docker/CI, harden, polish  

Details: [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)

---

## License

MIT (planned) — to be confirmed when the repository is published.
