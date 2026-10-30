# Cognitest API (`apps/api`)

Laravel 13 modular monolith — the central platform for clinics, patients,
test sessions, raw-event ingestion, scoring and reports.

```
app/
├── Domain/                 # business logic, framework-light
│   ├── Tenancy/            # TenantContext, TenantScope, RBAC, quotas, provisioning
│   ├── Sessions/           # SessionStatus state machine, player auth, lifecycle, calibration policy
│   ├── Events/             # batch validator (mirror of the zod contract), ingestor, stream
│   ├── Scoring/            # ScoringEngine port + Node adapter (packages/scoring-engine)
│   ├── Reports/            # report document builder, Chromium PDF renderer
│   └── Audit/              # audit logger
├── Http/                   # controllers (api/v1), middleware, requests, resources
├── Jobs/                   # ScoreSessionJob, RenderReportPdfJob (Horizon queues: scoring, reports)
└── Models/
```

## Local setup

```bash
cp .env.example .env && php artisan key:generate
# PostgreSQL roles: see infrastructure/postgres/init.sql
php artisan migrate --database=pgsql_owner --seed
pnpm --filter @cognitest/scoring-engine build   # scoring CLI used by the worker
php artisan serve
```

Demo accounts (local seed, password `password`): `admin@cognitest.ir`,
`owner@demo.cognitest.ir`, `clinician@demo.cognitest.ir`.

## Tests

```bash
php artisan test        # needs PostgreSQL (RLS and triggers are part of what is tested)
```

The suite includes cross-language contract tests: the event-batch fixture
from `packages/validation` and the session state machine from
`packages/shared-types` are checked against the PHP implementation.
