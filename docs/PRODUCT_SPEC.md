# FlowOps — Product Specification

**Product:** FlowOps — Production Deployment & Incident Intelligence Platform  
**Milestone:** M1 (Design)  
**Status:** Spec complete — implementation begins at M2  
**Audience:** Recruiters, hiring managers, and engineers evaluating system design ability

---

## 1. Problem Statement

Modern engineering orgs ship continuously across many services and environments, yet deployment visibility is often fragmented:

- Release status lives in CI logs, Slack threads, and tribal knowledge.
- Production approvals are ad-hoc (DMs, tickets) with weak audit trails.
- Incidents are created manually after someone notices a failed deploy.
- Rollbacks are tribal “run this script” knowledge rather than a governed workflow.

**FlowOps** is a local, simulation-first platform that models the full deployment lifecycle — queue → build → test → approve → deploy → health check → success/failure/rollback — with RBAC, auditability, and real-time updates. It demonstrates how a production-grade DevOps control plane is designed and built end-to-end.

> **Simulation Mode:** FlowOps never deploys to real infrastructure. Builds, health checks, and rollbacks are local simulations driven by BullMQ workers so the product is fully runnable with Docker Compose.

---

## 2. Goals

| Goal | Success criteria |
|------|------------------|
| End-to-end deployment lifecycle | Every status in the state machine is reachable and observable |
| Governed production releases | Prod deploys require approval; decisions are audited |
| Incident intelligence | Failed deploys auto-create incidents with linkage to service/env/deploy |
| Real-time ops UX | Dashboard and detail views update via WebSockets without refresh |
| Portfolio clarity | Recruiter can run `docker compose up`, explore seed data, and read architecture docs |

### Non-goals (M1–M14)

- Real cloud deploys (AWS/GCP/Azure/K8s)
- Real CI integrations (GitHub Actions as *product* CI for FlowOps itself is in scope; FlowOps does not trigger external pipelines)
- Multi-region HA / enterprise SSO / billing
- Mobile native apps

---

## 3. Personas & Roles (RBAC)

| Role | Intent | Capabilities (summary) |
|------|--------|------------------------|
| **Admin** | Own the org | Full CRUD on users, teams, services, env config, audit export |
| **Release Manager** | Gate production | Approve/reject prod deploys; view all deployments & incidents |
| **DevOps** | Operate releases | Create/trigger deployments, rollbacks, manage health config |
| **Developer** | Ship changes | Create deployments for non-prod; view own service deployments |
| **Viewer** | Observe | Read-only dashboards, deployments, incidents, audit (scoped) |

Roles are organization-scoped. A user may belong to multiple orgs with different roles.

---

## 4. Core Modules

### 4.1 Auth

- Email/password registration & login (portfolio seed accounts)
- JWT access tokens + rotating refresh tokens (HttpOnly cookie or body strategy documented in API spec)
- Role-based guards on every mutating endpoint
- Logout / refresh / me endpoints

### 4.2 Organizations & Teams

- Organization as tenancy boundary
- Teams group users; services can be owned by a team
- Membership invites (simplified: Admin assigns members in seed/API)

### 4.3 Services

- Named services with slug, description, owner team, repository URL (informational)
- Active/inactive flag
- Seed: ≥10 realistic services (e.g. `payments-api`, `checkout-web`, `inventory-worker`)

### 4.4 Environments

- Fixed set per org: **Dev**, **QA**, **UAT**, **Prod**
- Prod requires approval; others auto-progress past approval gate
- Environment-specific health check configuration

### 4.5 Deployments

Full lifecycle state machine:

```
QUEUED → BUILDING → TESTING → WAITING_FOR_APPROVAL → DEPLOYING → HEALTH_CHECK → SUCCESS
```

Failure / rollback paths:

```
BUILDING → FAILED
DEPLOYING → FAILED → ROLLBACK_REQUIRED → ROLLING_BACK → ROLLED_BACK
HEALTH_CHECK → FAILED → ROLLBACK_REQUIRED → …
```

Each deployment records: service, environment, version/tag, triggered_by, timestamps per stage, failure reason, linked approval & incident (nullable).

### 4.6 Approvals

- Required when `environment.slug = prod` (or `requires_approval = true`)
- Release Manager / Admin approve or reject with comment
- Rejection → deployment `FAILED` with reason; Approval → resume to `DEPLOYING`

### 4.7 Health Checks (simulated)

- After `DEPLOYING`, worker runs simulated health checks (latency, success rate knobs)
- Pass → `SUCCESS`; Fail → enter rollback path

### 4.8 Incidents

- Auto-created on deployment failure / health failure / rollback required
- Severity: `SEV1`–`SEV4`
- Status: `OPEN` → `INVESTIGATING` → `MITIGATED` → `RESOLVED`
- Linked to deployment, service, environment
- Manual create/update for Demo Ops scenarios

### 4.9 Rollback

- Local simulation only: queue job that transitions `ROLLING_BACK` → `ROLLED_BACK`
- Records previous successful version when available
- Audited

### 4.10 Audit Logs

- Append-only records for security-relevant and ops-relevant actions
- Actor, action, entity type/id, metadata JSON, IP (optional), timestamp
- Seed: ≥100 realistic records

### 4.11 Real-time (WebSockets)

- Channels: org dashboard, deployment detail, incident feed
- Events: deployment status changes, approval requested/resolved, incident created/updated

### 4.12 Simulation Mode

- Explicit banner in UI: “Simulation Mode — no real infrastructure”
- Configurable failure rates for build/deploy/health (admin settings or env vars)
- Deterministic seed + optional random chaos for demos

### 4.13 Observability (application)

- Structured JSON logs (NestJS)
- Request correlation IDs
- Basic metrics endpoints / health for API and workers (liveness/readiness)

### 4.14 Security

- Password hashing (argon2/bcrypt)
- Helmet, CORS allowlist, rate limiting on auth
- Input validation (class-validator / Zod at boundaries)
- No secrets in git; `.env.example` only

---

## 5. Primary User Flows

### Flow A — Non-prod deploy (happy path)

1. Developer selects service + Dev/QA/UAT + version tag  
2. System creates deployment `QUEUED`  
3. Workers advance BUILDING → TESTING → (skip approval) → DEPLOYING → HEALTH_CHECK → SUCCESS  
4. Dashboard updates live; audit entries written per transition  

### Flow B — Prod deploy with approval

1. DevOps/Release Manager creates prod deployment  
2. Pipeline reaches `WAITING_FOR_APPROVAL`; Release Manager notified (in-app)  
3. Approve → DEPLOYING → HEALTH_CHECK → SUCCESS  
4. Or Reject → FAILED + audit + optional incident  

### Flow C — Failed deploy → incident → rollback

1. Deploy fails at DEPLOYING or HEALTH_CHECK  
2. Status → FAILED / ROLLBACK_REQUIRED; incident auto-created  
3. DevOps triggers rollback → ROLLING_BACK → ROLLED_BACK  
4. Incident can be mitigated/resolved with notes  

### Flow D — Audit & investigate

1. Viewer/Admin filters audit by actor, action, entity, time range  
2. Drill into linked deployment or incident  

---

## 6. Seed Data Requirements

| Entity | Minimum | Notes |
|--------|---------|-------|
| Organizations | 1–2 | Realistic names (e.g. “Northstar Commerce”) |
| Users | ≥8 | Named people + roles; no “Test User” |
| Teams | ≥3 | Platform, Payments, Storefront, etc. |
| Services | ≥10 | Realistic slugs/names |
| Environments | 4 | Dev, QA, UAT, Prod |
| Deployments | ≥50 | Mixed statuses including failures/rollbacks |
| Incidents | ≥20 | Linked to failed deployments where appropriate |
| Audit records | ≥100 | Cover auth, deploy, approval, rollback |

---

## 7. UX Principles

- **Dark-first** serious DevOps UI (Linear / Datadog / Vercel-inspired, original)
- Dense but scannable tables; clear status chips; timeline for deployment stages
- One primary CTA per view; empty / loading / error states for every list
- Simulation Mode always visible so demos are honest

---

## 8. Acceptance Criteria (product-level)

- [ ] All modules in §4 are specified and mapped to API + schema  
- [ ] Deployment state machine is unambiguous (this doc + ARCHITECTURE)  
- [ ] RBAC matrix covers every mutating API (API_SPEC)  
- [ ] Seed data plan meets counts above  
- [ ] Simulation Mode is explicit in product language  

---

## 9. Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design  
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) — PostgreSQL schema & ERD  
- [API_SPEC.md](./API_SPEC.md) — REST + WebSocket contracts  
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — milestones M1–M14  
- [../README.md](../README.md) — portfolio overview  
