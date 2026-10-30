# Cognitest API (Laravel 13 / PHP 8.4-FPM) and queue worker. Build context: repository root.
#   docker build -f infrastructure/docker/api.Dockerfile --target api    -t cognitest/api .
#   docker build -f infrastructure/docker/api.Dockerfile --target worker -t cognitest/worker .
#
# Layer order is chosen for fast updates: system packages (PHP extensions,
# Chromium, fonts) live in base stages that never depend on application
# code, so an update only re-runs the final COPY steps.

ARG PHP_VERSION=8.4
ARG NODE_VERSION=22
# Mirrors for restricted networks (see scripts/install.sh --npm-registry / --apt-mirror).
ARG NPM_REGISTRY=https://registry.npmjs.org
ARG COMPOSER_INSTALL_FLAGS=--prefer-dist
ARG DEBIAN_MIRROR=

# --- Composer dependencies -------------------------------------------------
FROM composer:2 AS vendor
ARG COMPOSER_INSTALL_FLAGS
WORKDIR /app
COPY apps/api/composer.json apps/api/composer.lock ./
# Platform extensions (pcntl, redis, …) exist in the runtime image, not here.
RUN composer install --no-dev --no-scripts --no-autoloader ${COMPOSER_INSTALL_FLAGS} --no-interaction --ignore-platform-reqs
COPY apps/api/ ./
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev --ignore-platform-reqs

# --- Scoring engine CLI (single ESM bundle) -------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS scoring
ARG NPM_REGISTRY
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NPM_CONFIG_REGISTRY=${NPM_REGISTRY} COREPACK_NPM_REGISTRY=${NPM_REGISTRY}
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile
COPY tsconfig.base.json turbo.json ./
COPY packages/ packages/
RUN pnpm install --offline --frozen-lockfile --filter "@cognitest/scoring-engine..." \
 && pnpm --filter @cognitest/scoring-engine build

FROM node:${NODE_VERSION}-trixie-slim AS node

# --- PHP base: extensions and configuration only ---------------------------
FROM php:${PHP_VERSION}-fpm-trixie AS php-base
ARG DEBIAN_MIRROR
# Debian mirror (e.g. inside Iran) + retries, so a stalled download is retried
# instead of hanging the build. Mirror layout: $DEBIAN_MIRROR/debian(-security).
RUN if [ -n "$DEBIAN_MIRROR" ]; then \
      sed -i "s#http://deb.debian.org#${DEBIAN_MIRROR%/}#g" /etc/apt/sources.list.d/debian.sources; \
    fi \
 && printf 'Acquire::Retries "5";\nAcquire::http::Timeout "30";\nAcquire::https::Timeout "30";\n' > /etc/apt/apt.conf.d/80-cognitest-retries
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev libicu-dev libzip-dev unzip \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl pcntl zip opcache \
    && pecl install redis && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/* /tmp/pear
COPY infrastructure/docker/php/php.ini /usr/local/etc/php/conf.d/zz-cognitest.ini
COPY infrastructure/docker/php/www.conf /usr/local/etc/php-fpm.d/zz-www.conf
ENV LOG_CHANNEL=stderr \
    FPM_MAX_CHILDREN=24 \
    SCORING_CLI_PATH=/opt/cognitest/scoring-cli.mjs
WORKDIR /var/www/api

# --- Worker base: + Node.js (scoring) + headless Chromium & fonts (PDF) ----
FROM php-base AS worker-base
COPY --from=node /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium-headless-shell fonts-vazirmatn fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
ENV SCORING_NODE_BINARY=/usr/local/bin/node \
    PDF_CHROMIUM_BINARY=/usr/bin/chromium-headless-shell

# --- API (PHP-FPM) -----------------------------------------------------------
FROM php-base AS api
COPY --from=vendor --chown=www-data:www-data /app ./
COPY --from=scoring /repo/packages/scoring-engine/dist/cli.mjs /opt/cognitest/scoring-cli.mjs
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
        storage/app/private/reports storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["php", "-r", "exit(@fsockopen('127.0.0.1', 9000) ? 0 : 1);"]
EXPOSE 9000
CMD ["php-fpm", "--nodaemonize"]

# --- Worker (Horizon / scheduler) ------------------------------------------
FROM worker-base AS worker
COPY --from=vendor --chown=www-data:www-data /app ./
COPY --from=scoring /repo/packages/scoring-engine/dist/cli.mjs /opt/cognitest/scoring-cli.mjs
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
        storage/app/private/reports storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
HEALTHCHECK --interval=60s --timeout=10s --retries=3 CMD ["php", "artisan", "horizon:status"]
CMD ["php", "artisan", "horizon"]
