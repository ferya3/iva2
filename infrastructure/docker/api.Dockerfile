# Cognitest API (Laravel 13 / PHP 8.4-FPM). Build context: repository root.
#   docker build -f infrastructure/docker/api.Dockerfile -t cognitest/api .

ARG PHP_VERSION=8.4
ARG NODE_VERSION=22
# Mirrors for restricted networks (see scripts/install.sh --npm-registry).
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
COPY . .
RUN pnpm install --frozen-lockfile --filter "@cognitest/scoring-engine..." \
 && pnpm --filter @cognitest/scoring-engine build

# --- Runtime ---------------------------------------------------------------
FROM php:${PHP_VERSION}-fpm-trixie AS api
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

WORKDIR /var/www/api
COPY --from=vendor --chown=www-data:www-data /app ./
COPY --from=scoring /repo/packages/scoring-engine/dist/cli.mjs /opt/cognitest/scoring-cli.mjs
ENV SCORING_CLI_PATH=/opt/cognitest/scoring-cli.mjs \
    LOG_CHANNEL=stderr

RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views \
        storage/app/private/reports storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache
USER www-data
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["php", "-r", "exit(@fsockopen('127.0.0.1', 9000) ? 0 : 1);"]
EXPOSE 9000
CMD ["php-fpm", "--nodaemonize"]
