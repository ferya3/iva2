# syntax=docker/dockerfile:1.7
# Queue worker (Horizon) and scheduler: the API image plus Node.js (scoring
# engine) and headless Chromium with Persian fonts (PDF reports).
#   docker build -f infrastructure/docker/worker.Dockerfile -t cognitest/worker .

ARG API_IMAGE=cognitest/api:latest
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-trixie-slim AS node

FROM ${API_IMAGE}
USER root
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium-headless-shell fonts-vazirmatn fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV SCORING_NODE_BINARY=/usr/local/bin/node \
    PDF_CHROMIUM_BINARY=/usr/bin/chromium-headless-shell
USER www-data
HEALTHCHECK --interval=60s --timeout=10s --retries=3 CMD ["php", "artisan", "horizon:status"]
CMD ["php", "artisan", "horizon"]
