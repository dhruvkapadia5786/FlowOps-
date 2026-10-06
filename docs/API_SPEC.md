# FlowOps — API Specification

**Style:** REST JSON over HTTPS  
**Auth:** Bearer JWT access token; refresh via `POST /auth/refresh`  
**Base path:** `/api/v1`  
**WebSocket:** `/ws` (Socket.IO path configurable)

Conventions:

- UUIDs for all resource ids  
- Timestamps ISO-8601 UTC  
- List endpoints support `page`, `pageSize` (default 20, max 100), `sort`, filters  
- Errors: `{ "statusCode": number, "message": string | string[], "error": string, "requestId": string }`  
- All mutating org-scoped routes require `X-Org-Id` header **or** `orgId` claim bound after login context selection

---

## 1. Auth

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/auth/register` | — | — | Register user (disabled in prod demo flag; enabled for portfolio) |
| POST | `/auth/login` | — | — | Returns `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | refresh | — | Rotate refresh; return new tokens |
| POST | `/auth/logout` | access | any | Revoke refresh token |
| GET | `/auth/me` | access | any | Current user + memberships |

### `POST /auth/login`

```json
{ "email": "maya.chen@northstar.io", "password": "••••••••" }
```

### RBAC note

Login is global; subsequent requests operate in an **organization context** selected via `POST /orgs/{id}/select` (returns access token with `orgId` + `role`) or `X-Org-Id` validated against membership.

---

## 2. Organizations & Teams

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/orgs` | any | List orgs for current user |
| GET | `/orgs/:orgId` | member | Org detail |
| POST | `/orgs` | authenticated | Create org (creator → admin) |
| GET | `/orgs/:orgId/members` | admin, viewer+ | List members |
| POST | `/orgs/:orgId/members` | admin | Add/update member role |
| PATCH | `/orgs/:orgId/members/:userId` | admin | Change role |
| DELETE | `/orgs/:orgId/members/:userId` | admin | Remove member |
| GET | `/teams` | member | List teams in org context |
| POST | `/teams` | admin, devops | Create team |
| GET | `/teams/:teamId` | member | Team detail + members |
| POST | `/teams/:teamId/members` | admin, devops | Add team member |
| DELETE | `/teams/:teamId/members/:userId` | admin, devops | Remove |

---

## 3. Services

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/services` | member | List/filter (`q`, `teamId`, `isActive`) |
| POST | `/services` | admin, devops | Create service |
| GET | `/services/:id` | member | Detail |
| PATCH | `/services/:id` | admin, devops | Update |
| POST | `/services/:id/deactivate` | admin | Soft deactivate |

### Create body

```json
{
  "name": "Payments API",
  "slug": "payments-api",
  "description": "Card capture and settlement service",
  "teamId": "uuid",
  "repositoryUrl": "https://github.com/northstar/payments-api"
}
```

---

## 4. Environments

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/environments` | member | List envs for org |
| GET | `/environments/:id` | member | Detail + health config |
| PATCH | `/environments/:id` | admin, devops | Update `requiresApproval`, health config |

Seed creates Dev/QA/UAT/Prod; creation API optional (admin-only) for extensibility.

---

## 5. Deployments

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/deployments` | member | Filter: `status`, `serviceId`, `environmentId`, `from`, `to` |
| POST | `/deployments` | devops, developer*, release_manager, admin | Create & enqueue |
| GET | `/deployments/:id` | member | Detail + latest events |
| GET | `/deployments/:id/events` | member | Full timeline |
| POST | `/deployments/:id/cancel` | devops, admin | Cancel if still `queued`/`building` (optional M3) |

\*Developer: non-prod only unless also Release Manager/Admin.

### Create body

```json
{
  "serviceId": "uuid",
  "environmentId": "uuid",
  "version": "1.14.2",
  "commitSha": "a1b2c3d"
}
```

### Deployment DTO (response excerpt)

```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "environmentId": "uuid",
  "version": "1.14.2",
  "status": "waiting_for_approval",
  "triggeredBy": { "id": "uuid", "fullName": "Maya Chen" },
  "failureReason": null,
  "createdAt": "2026-10-06T08:00:00.000Z",
  "updatedAt": "2026-10-06T08:01:12.000Z"
}
```

---

## 6. Approvals

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/approvals` | release_manager, admin, devops | Filter `status=pending` |
| GET | `/approvals/:id` | member | Detail |
| POST | `/approvals/:id/decide` | release_manager, admin | Approve/reject |

### Decide body

```json
{ "decision": "approved", "comment": "Change window cleared; owners on call." }
```

`decision`: `approved` | `rejected`

---

## 7. Health (simulation config & probes)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/health-configs/:environmentId` | member | Get simulated health config |
| PUT | `/health-configs/:environmentId` | admin, devops | Upsert config |
| GET | `/health/live` | — | Process liveness |
| GET | `/health/ready` | — | DB + Redis readiness |

Deployment health results appear as `deployment_events`, not a separate public resource in M1 design.

---

## 8. Incidents

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/incidents` | member | Filter severity/status/service |
| POST | `/incidents` | devops, release_manager, admin | Manual create |
| GET | `/incidents/:id` | member | Detail |
| PATCH | `/incidents/:id` | devops, release_manager, admin | Update status/assignee/severity |
| POST | `/incidents/:id/resolve` | devops, release_manager, admin | Mark resolved |

Auto-created incidents use titles like `Deploy failed: payments-api@1.14.2 → prod`.

---

## 9. Rollback

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/deployments/:id/rollback` | devops, admin, release_manager | Start rollback simulation |
| GET | `/deployments/:id/rollback` | member | Rollback record if any |

Preconditions: status `rollback_required` (or `failed` with policy promotion). Response includes rollback id + target version.

---

## 10. Audit Logs

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/audit-logs` | admin, release_manager, viewer* | Filter action/entity/actor/from/to |

\*Viewer: read-only within org; Admin may export (M14 CSV optional).

### Example row

```json
{
  "id": "uuid",
  "action": "deployment.status_changed",
  "entityType": "deployment",
  "entityId": "uuid",
  "actor": { "id": "uuid", "fullName": "Jordan Blake" },
  "metadata": { "from": "deploying", "to": "failed" },
  "createdAt": "2026-10-06T08:02:01.000Z"
}
```

---

## 11. Notifications (in-app)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/notifications` | any | Current user notifications |
| POST | `/notifications/:id/read` | any | Mark read |
| POST | `/notifications/read-all` | any | Mark all read |

Types: `approval.requested`, `deployment.failed`, `incident.opened`, etc.

---

## 12. Simulation Controls (Admin)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/simulation/settings` | admin, devops | Current fail rates / delays |
| PUT | `/simulation/settings` | admin | Update org simulation knobs |
| POST | `/simulation/run-chaos-burst` | admin | Optional: enqueue N random deploys for demo |

Banner/flag `simulationMode: true` always returned from `GET /simulation/settings`.

---

## 13. WebSocket Events

**Connect:** `ws://host/ws?token=<accessToken>` then `emit('join', { orgId })`.

| Event | Payload (abbrev) | When |
|-------|------------------|------|
| `deployment.updated` | `{ id, status, version, serviceId }` | Each transition |
| `approval.requested` | `{ approvalId, deploymentId }` | Enter waiting |
| `approval.resolved` | `{ approvalId, status }` | Decide |
| `incident.created` | `{ id, severity, title }` | Auto/manual |
| `incident.updated` | `{ id, status }` | Patch/resolve |
| `notification.created` | `{ id, type }` | In-app notify |

---

## 14. Role × Verb Matrix (summary)

| Resource | Admin | RelMgr | DevOps | Developer | Viewer |
|----------|-------|--------|--------|-----------|--------|
| Members | RW | R | R | R | R |
| Services | RW | R | RW | R | R |
| Deployments create | ✓ | ✓ | ✓ | non-prod | — |
| Approvals decide | ✓ | ✓ | — | — | — |
| Rollback | ✓ | ✓ | ✓ | — | — |
| Incidents write | ✓ | ✓ | ✓ | — | — |
| Audit read | ✓ | ✓ | R* | — | ✓ |
| Simulation settings | ✓ | — | R | — | — |

\*DevOps audit read: recommended allow for ops if product chooses; default **Admin + Release Manager + Viewer**.

---

## 15. Pagination Envelope

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

## 16. Related Documents

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md)  
- [ARCHITECTURE.md](./ARCHITECTURE.md)  
- [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)  
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)  
