# FlowOps API (quick index)

Recruiter-facing summary. Full contract: [docs/API_SPEC.md](./docs/API_SPEC.md).

| | |
|--|--|
| Base URL | `http://127.0.0.1:43124/api/v1` |
| Auth | `Authorization: Bearer <accessToken>` |
| Org context | `X-Org-Id: <uuid>` (validated against membership) |
| Realtime | Socket.IO path `/ws` on the API host |
| Errors | `{ statusCode, message, error, requestId }` |
| Lists | `page` (default 1), `pageSize` (default 20, **max 100**) |

## Auth

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/auth/register` | Email + strong password (upper/lower/digit, min 10) |
| `POST` | `/auth/login` | Returns access + refresh + user |
| `POST` | `/auth/refresh` | Rotate refresh |
| `POST` | `/auth/logout` | Revoke refresh (auth required) |
| `GET` | `/auth/me` | Profile + memberships |

```bash
curl -s -X POST http://127.0.0.1:43124/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"maya.chen@northstar.io","password":"FlowOps!demo1"}'
```

Rate limits: login/register **10/min**, refresh **20/min** (stricter than the global throttle).

## Organizations

| Method | Path | Roles |
|--------|------|-------|
| `GET` | `/orgs` | authenticated |
| `POST` | `/orgs` | authenticated (creator → admin) |
| `GET` | `/orgs/:orgId/members` | member |
| `POST` | `/orgs/:orgId/members` | admin |
| `PATCH` | `/orgs/:orgId/members/:userId` | admin |
| `DELETE` | `/orgs/:orgId/members/:userId` | admin |
| `POST` | `/orgs/:orgId/select` | member — re-issue access token with org claim |

## Catalog

| Resource | List | Mutate roles |
|----------|------|--------------|
| Services | `GET /services` | admin, devops |
| Environments | `GET /environments` | update: admin, devops |
| Teams | `GET /teams` | admin, devops |

## Deployments

| Method | Path | Roles |
|--------|------|-------|
| `GET` | `/deployments` | member (filter: status, service, env, dates) |
| `POST` | `/deployments` | admin, devops, developer, release_manager |
| `GET` | `/deployments/:id` | member |
| `GET` | `/deployments/:id/events` | member |
| `GET` | `/deployments/:id/rollback` | member |
| `POST` | `/deployments/:id/rollback` | admin, devops, release_manager |

Lifecycle:

```text
QUEUED → BUILDING → TESTING → WAITING_FOR_APPROVAL → DEPLOYING → HEALTH_CHECK → SUCCESS
```

## Approvals · Incidents · Health · Audit

| Area | Key routes | Roles (mutate) |
|------|------------|----------------|
| Approvals | `GET /approvals`, `POST /approvals/:id/decide` | decide: admin, release_manager |
| Incidents | `GET/POST /incidents`, `PATCH`, `POST .../resolve` | admin, devops, release_manager |
| Health | `GET /health/live|ready` (public), `GET /service-health`, `POST /service-health/run` | run: admin, devops |
| Audit | `GET /audit-logs` | admin, release_manager, devops, viewer |
| Notifications | `GET /notifications`, mark read | owner user |
| Simulation | `GET/PUT /simulation/settings`, scenario run/recover | admin / devops (see matrix) |

## WebSocket events

Connect with access token; join org room after auth. Event names include:

- `deployment.updated`
- `approval.requested`
- `incident.created` / `incident.updated`

## RBAC snapshot

| Role | Typical powers |
|------|----------------|
| Admin | Full org admin, simulation, member roles |
| DevOps | Services, deploys, health runs, simulation |
| Developer | Create non-sensitive deploys; read ops data |
| Release Manager | Prod approvals, incidents, audit |
| Viewer | Read-mostly (deployments, audit, health) |

Server **ignores JWT `role` claims** — membership is loaded from Postgres (short Redis cache). Details: [SECURITY.md](./SECURITY.md).
