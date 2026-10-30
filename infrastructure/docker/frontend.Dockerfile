# Next.js panels (standalone output). Build context: repository root.
#   docker build -f infrastructure/docker/frontend.Dockerfile --build-arg APP=clinic-web -t cognitest/clinic-web .

ARG NODE_VERSION=22
ARG NPM_REGISTRY=https://registry.npmjs.org

FROM node:${NODE_VERSION}-trixie-slim AS build
ARG APP
ARG NPM_REGISTRY
ENV NEXT_TELEMETRY_DISABLED=1 ELECTRON_SKIP_BINARY_DOWNLOAD=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NPM_CONFIG_REGISTRY=${NPM_REGISTRY} COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cognitest/${APP}..." \
 && pnpm --filter @cognitest/${APP} build

FROM node:${NODE_VERSION}-trixie-slim AS runtime
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
RUN ln -s /app/apps/${APP}/server.js /app/entry.js
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "entry.js"]
