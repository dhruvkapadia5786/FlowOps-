# FlowOps API

NestJS backend for FlowOps (Milestone 2+).

## Quick start

```bash
# from apps/api
cp .env.example .env
# ensure Postgres is running and DATABASE_URL is correct
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

API base: `http://127.0.0.1:43124/api/v1`

### Seed accounts

| Email | Password | Role |
|-------|----------|------|
| maya.chen@northstar.io | FlowOps!demo1 | admin |
| jordan.blake@northstar.io | FlowOps!demo1 | devops |

### Useful commands

```bash
npm test
npm run build
npx prisma studio
```

See repository root [README](../../README.md) and [docs](../../docs/).
