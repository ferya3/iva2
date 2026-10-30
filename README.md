# Cognitest

**سکوی مستقل ارزیابی شناختی** برای کلینیک‌های روان‌شناسی و مراکز ارزیابی — بازار ایران، اجرای آزمون روی دسکتاپ، مدل SaaS چندکلینیکی.

> «Cognitest» نام داخلی پروژه است و پیش از عرضه باید از نظر برند و دامنه بررسی شود.
> پروتکل همراه مخزن (`demo-cpt`) یک تکلیف Go/No-Go عمومی و **غیربالینی** است؛ هیچ آزمون تجاری را بازتولید نمی‌کند و تا پیش از اعتبارسنجی علمی نباید برای تشخیص به کار رود.

| بخش           | فناوری                                                                   | مسیر                                         |
| ------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| هسته مرکزی    | Laravel 13 · PHP 8.4 · PostgreSQL 17 (RLS) · Redis 8 · Horizon · Sanctum | [`apps/api`](apps/api)                       |
| پنل کلینیک    | Next.js 16 · React 19 · Tailwind 4 · RTL فارسی · ECharts                 | [`apps/clinic-web`](apps/clinic-web)         |
| پنل مدیریت کل | Next.js 16                                                               | [`apps/admin-web`](apps/admin-web)           |
| اجرای آزمون   | Electron 45 · React · موتور TypeScript · SQLite رمزنگاری‌شده             | [`apps/desktop-player`](apps/desktop-player) |
| هسته مشترک    | ۱۱ پکیج TypeScript (موتور آزمون، زمان‌بندی، کالیبراسیون، تحلیل، …)       | [`packages/`](packages)                      |
| زیرساخت       | Docker Compose · Nginx · Prometheus                                      | [`infrastructure/`](infrastructure)          |

## مستندات

- [معماری و تصمیم‌ها](docs/architecture/README.md) · [مدل زمان‌بندی](docs/architecture/timing-model.md)
- [پایگاه داده](docs/database/README.md) · [API (OpenAPI)](docs/api/openapi.yaml) · [JSON Schemaهای قرارداد](docs/api/schemas)
- [پروتکل اعتبارسنجی](docs/validation/README.md) · [استقرار](docs/operations/deployment.md) · [نقشه توسعه](docs/roadmap.md)

## نصب روی سرور (Ubuntu 24.04)

```bash
curl -fsSL https://raw.githubusercontent.com/ferya3/iva2/claude/kind-maxwell-ibgtgr/scripts/install.sh | sudo bash -s -- --domain example.ir --email ops@example.ir
```

بدون دامنه (روی IP سرور، با گواهی self-signed):

```bash
curl -fsSL https://raw.githubusercontent.com/ferya3/iva2/claude/kind-maxwell-ibgtgr/scripts/install.sh | sudo bash -s -- --ip
```

جزئیات، گزینه‌ها (از جمله آینه Docker برای سرورهای داخل ایران) و نسخه مخزن خصوصی: [docs/operations/deployment.md](docs/operations/deployment.md).

## شروع سریع (توسعه)

پیش‌نیازها: Node 22+، pnpm 10، PHP 8.3+ با `pdo_pgsql` و `redis`، Composer، PostgreSQL 16+، Redis.

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install      # روی ویندوز برای اجرای پلیر بدون این متغیر
pnpm --filter @cognitest/scoring-engine build     # CLI تحلیل که API اجرا می‌کند
```

```bash
# PostgreSQL: نقش‌ها و پایگاه داده (یک‌بار)
sudo -u postgres psql -c "CREATE ROLE cognitest LOGIN PASSWORD 'secret' CREATEDB" \
  -c "CREATE ROLE cognitest_app LOGIN PASSWORD 'secret'" -c "GRANT cognitest_app TO cognitest" \
  -c "CREATE DATABASE cognitest OWNER cognitest" -c "CREATE DATABASE cognitest_test OWNER cognitest"
```

```bash
cd apps/api && composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --database=pgsql_owner --seed   # شامل داده نمایشی و یک جلسه تحلیل‌شده
php artisan serve                                    # http://localhost:8000
php artisan horizon                                  # worker صف‌های scoring و reports
```

```bash
pnpm --filter @cognitest/clinic-web dev     # http://localhost:3000
pnpm --filter @cognitest/admin-web dev      # http://localhost:3001
pnpm --filter @cognitest/desktop-player dev # Electron
```

حساب‌های نمایشی (رمز `password`): `owner@demo.cognitest.ir` و `clinician@demo.cognitest.ir` (پنل کلینیک)، `admin@cognitest.ir` (مدیریت کل).

## تست‌ها

```bash
pnpm turbo run typecheck test          # همه پکیج‌ها و اپ‌های TypeScript
cd apps/api && php artisan test        # API روی PostgreSQL (RLS و triggerها هم تست می‌شوند)
```

## ساختار

```
cognitest/
├── apps/            api · clinic-web · admin-web · desktop-player
├── packages/        assessment-engine · stimulus-renderer · audio-engine · timing-core · event-recorder
│                    calibration · scoring-engine · report-schema · shared-types · validation · ui
├── infrastructure/  docker · nginx · postgres · monitoring
├── docs/            architecture · api · database · validation · operations
├── scripts/         تولید fixture نمایشی و خروجی پروتکل
├── docker-compose.yml
└── pnpm-workspace.yaml
```
