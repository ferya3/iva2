<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Second line of tenant isolation: PostgreSQL Row-Level Security.
 *
 * The application connects as `cognitest_app` (a non-owner role, see
 * infrastructure/postgres/init.sql), to which these policies apply. Each
 * request sets `app.tenant_id` (TenantContext); system contexts (queue
 * workers, platform admin) set `app.bypass_rls = on` explicitly. With no
 * context set, every tenant table reads as empty — fail closed.
 */
return new class extends Migration
{
    public const TABLES = [
        'tenant_settings', 'subscriptions', 'audit_logs',
        'patients', 'patient_profiles', 'guardians', 'consents', 'patient_notes',
        'test_sessions', 'session_tokens', 'device_profiles', 'calibration_results', 'session_states',
        'event_batches', 'stimulus_events', 'response_events', 'session_events',
        'scoring_runs', 'scoring_metrics', 'validity_results', 'reports', 'report_files', 'report_access_logs',
    ];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION app_tenant_visible(row_tenant uuid) RETURNS boolean
            LANGUAGE sql STABLE AS $$
                SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
                    OR row_tenant::text = nullif(current_setting('app.tenant_id', true), '')
            $$;
        SQL);

        foreach (self::TABLES as $table) {
            DB::unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY");
            DB::unprepared("DROP POLICY IF EXISTS tenant_isolation ON {$table}");
            DB::unprepared(
                "CREATE POLICY tenant_isolation ON {$table} USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id))"
            );
        }

        // Grant the runtime role access when it exists (created by init.sql).
        DB::unprepared(<<<'SQL'
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cognitest_app') THEN
                    EXECUTE 'GRANT USAGE ON SCHEMA public TO cognitest_app';
                    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cognitest_app';
                    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cognitest_app';
                END IF;
            END $$;
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach (self::TABLES as $table) {
            DB::unprepared("DROP POLICY IF EXISTS tenant_isolation ON {$table}");
            DB::unprepared("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY");
        }
        DB::unprepared('DROP FUNCTION IF EXISTS app_tenant_visible(uuid)');
    }
};
