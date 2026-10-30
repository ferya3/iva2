# syntax=docker/dockerfile:1.7
# Cognitest API (Laravel 13 / PHP 8.4-FPM). Build context: repository root.
#   docker build -f infrastructure/docker/api.Dockerfile -t cognitest/api .

ARG PHP_VERSION=8.4
ARG NODE_VERSION=22

# --- Composer dependencies -------------------------------------------------
FROM composer:2 AS vendor
WORKDIR /app
COPY apps/api/composer.json apps/api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY apps/api/ ./
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

# --- Scoring engine CLI (single ESM bundle) -------------------------------
FROM node:${NODE_VERSION}-trixie-slim AS scoring
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --filter @cognitest/scoring-engine... \
 && pnpm --filter @cognitest/scoring-engine build

# --- Runtime ---------------------------------------------------------------
FROM php:${PHP_VERSION}-fpm-trixie AS api
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev libicu-dev libzip-dev unzip \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl pcntl zip opcache \
    && pecl install redis && docker-php-ext-enable redis \
    && apt-get purge -y --auto-remove libpq-dev libicu-dev libzip-dev \
    && apt-get install -y --no-install-recommends libpq5 libicu76 libzip5 \
    && rm -rf /var/lib/apt/lists/* /tmp/pear
COPY infrastructure/docker/php/php.ini /usr/local/etc/php/conf.d/zz-cognitest.ini
COPY infrastructure/docker/php/www.conf /usr/local/etc/php-fpm.d/zz-www.conf

WORKDIR /var/www/api
COPY --from=vendor --chown=www-data:www-data /app ./
COPY --from=scoring /repo/packages/scoring-engine/dist/cli.mjs /opt/cognitest/scoring-cli.mjs
ENV SCORING_CLI_PATH=/opt/cognitest/scoring-cli.mjs \
    LOG_CHANNEL=stderr

RUN mkdir -p storage/framework/{cache,sessions,views} storage/app/private bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["php", "-r", "exit(@fsockopen('127.0.0.1', 9000) ? 0 : 1);"]
EXPOSE 9000
CMD ["php-fpm", "--nodaemonize"]
