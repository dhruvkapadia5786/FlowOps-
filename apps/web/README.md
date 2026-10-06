# FlowOps Web (`apps/web`)

Angular 20 SPA for the FlowOps control plane.

## Run

```bash
npm install
npm start
```

Opens [http://127.0.0.1:43125](http://127.0.0.1:43125). Requires the API at `http://127.0.0.1:43124/api/v1`.

Configure base URL in `src/environments/environment*.ts`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Dev server (port 43125) |
| `npm test` | Karma unit tests (ChromeHeadless) |
| `npm run build` | Production build |

## Stack

Angular 20 · Tailwind CSS 4 · Angular CDK · Signals · standalone components
