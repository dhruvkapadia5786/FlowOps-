## Summary

<!-- What does this PR change and why? Keep it recruiter-readable. -->

## Scope

- [ ] Docs / README
- [ ] API
- [ ] Web
- [ ] Tests
- [ ] Docker / CI
- [ ] Security / perf

## Verify

```bash
cd apps/api && npm run lint && npm test && npm run build
cd apps/web && npm test && npm run build

# optional one-command demo
docker compose up --build
```

## Screenshots / notes

<!-- UI PRs: attach before/after or link docs/screenshots -->

## Checklist

- [ ] Conventional commit messages
- [ ] No secrets committed (`.env` stays gitignored)
- [ ] Simulation framing preserved (local-only deploys)
- [ ] Docs updated if env vars / APIs / run steps changed
- [ ] RBAC / org scoping considered for new endpoints
