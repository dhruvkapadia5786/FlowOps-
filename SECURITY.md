# FlowOps Security Notes

Simulation-first portfolio app. This document records the M13 security/perf review checklist and the hardening that shipped. It is **not** a penetration-test report.

## Threat model (honest)

| In scope | Out of scope (intentional) |
|----------|------------------------------|
| Authn/authz for the demo SaaS boundary | Real cloud IAM / SSO / MFA |
| Abuse of public auth endpoints | DDoS at network edge |
| Secrets leaking into git | Paid secret scanners / WAF |
| Org-scoped data isolation | Multi-region isolation |
| Local Compose defaults | Production K8s hardening |

FlowOps **never** deploys to real infrastructure. Simulation knobs must stay local.

## Checklist (M13)

| Area | Status | Notes |
|------|--------|-------|
| Password hashing (argon2) | Done | Register/login |
| JWT access + refresh rotation | Done | Refresh hashed at rest |
| RBAC via org membership (DB/cache) | Done | JWT `role` claim **ignored** server-side |
| Helmet + CORS allowlist | Done | Open CORS rejected in `production` |
| Global + auth rate limits | Done | Auth 10/min; health skipped |
| Input validation (class-validator) | Done | Whitelist + forbid unknown |
| Pagination caps | Done | `pageSize` max 100 |
| Secrets via env / `.env` gitignored | Done | JWT secrets ≥ 32 chars |
| CI secret pattern scan | Done | Cheap grep gate in Actions |
| Structured log redaction | Done | `authorization`, `cookie` |
| Append-only audit | Done | No update/delete APIs |
| SPA security headers (nginx) | Done | nosniff, frame, referrer, COOP |
| Redis membership / env cache | Done | Short TTL; invalidated on role change |
| Indexes for list filters | Done | Deployments + approvals composites |

## Operational defaults

- **Compose JWT secrets** are demo-only (`compose-dev-*-secret-change-me`). Rotate before any shared demo host.
- **CORS_ORIGIN** must be an explicit comma-separated allowlist when `NODE_ENV=production`.
- **Postgres/Redis** stay on the Compose network (no host publish by default).

## Reporting

This is a personal portfolio project. For issues found while reviewing the code, open a GitHub issue (when the public repo exists) or contact the maintainer via the profile linked from the README.

## Related

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) §11 Security Architecture  
- [docs/API_SPEC.md](./docs/API_SPEC.md) RBAC matrix  
- [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) M13  
