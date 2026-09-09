# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build
ARG REVISION=development
RUN printf '{"revision":"%s"}\n' "$REVISION" > dist/version.json

FROM nginxinc/nginx-unprivileged:1.28-alpine AS web
LABEL org.opencontainers.image.source="https://github.com/dbsanfte/vet-game"
ARG REVISION=development
LABEL org.opencontainers.image.revision="$REVISION"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
