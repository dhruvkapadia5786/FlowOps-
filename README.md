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
| Frontend | Angular 20+ |
| API | NestJS (modular monolith) |
| Data | PostgreSQL |
| Jobs / realtime fabric | Redis + BullMQ + WebSockets |
| Delivery | Docker Compose · GitHub Actions |
| Tests | Jest · Playwright |

---

## Current status

| Milestone | Focus | Status |
|-----------|-------|--------|
| **M1** | Architecture · product spec · database design · API spec · implementation plan | **In progress (this branch)** |
| M2–M14 | Implementation through portfolio polish | Not started |

Application code is intentionally **not** scaffolded yet. Design docs are the M1 deliverable.

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

## Product modules (planned)

Auth (JWT + refresh, RBAC) · Organizations/Teams · Services · Environments (Dev/QA/UAT/Prod) · Deployments · Approvals · Health checks (simulated) · Incidents · Rollback (local simulation) · Audit logs · WebSockets · Simulation Mode · Observability · Security · Tests · Docker + CI/CD

---

## Run locally

**M1:** no runtime — read the docs:

```bash
ls docs/
# PRODUCT_SPEC.md  ARCHITECTURE.md  DATABASE_DESIGN.md  API_SPEC.md  IMPLEMENTATION_PLAN.md
```

**After M12:** one-command demo (planned):

```bash
docker compose up --build
```

Seed targets (planned): ≥10 services, 4 environments, ≥50 deployments, ≥20 incidents, ≥100 audit records — realistic names, no lorem.

---

## Screenshots

Feature screenshots and walkthrough GIFs land in **M14** (portfolio polish). Until then, architecture and ERD diagrams in `docs/` are the visual entry points (render Mermaid on GitHub).

---

## Roadmap snapshot

1. **M1** Design docs ← you are here  
2. **M2** NestJS + auth + database  
3. **M3–M5** Deployments, approvals/rollback, health/incidents  
4. **M6** WebSockets  
5. **M7–M9** Angular UI  
6. **M10–M14** Simulation, tests, Docker/CI, harden, polish  

Details: [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)

---

## License

MIT (planned) — to be confirmed when the repository is published.
