# FlowOps web — Angular multi-stage build served by nginx
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public ./public
COPY src ./src
# Browser talks to published host ports (compose maps api:43124)
ARG FLOWOPS_API_BASE_URL=http://127.0.0.1:43124/api/v1
ARG FLOWOPS_WS_URL=http://127.0.0.1:43124
RUN printf "export const environment = {\n  production: true,\n  apiBaseUrl: '%s',\n  wsUrl: '%s',\n  wsPath: '/ws',\n};\n" \
  "$FLOWOPS_API_BASE_URL" "$FLOWOPS_WS_URL" > src/environments/environment.ts \
  && npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/web/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
