<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Database-enforced invariants that must hold even if application code is
 * wrong: raw data is append-only and published protocols are immutable.
 * Deleting a whole tenant/session still cascades (TRUNCATE / cascade are
 * statement-level operations performed by the owner during erasure).
 */
return new class extends Migration
{
    private const APPEND_ONLY = ['event_batches', 'stimulus_events', 'response_events', 'session_events', 'session_states', 'audit_logs'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION forbid_update() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'P0001';
            END $$;

            CREATE OR REPLACE FUNCTION forbid_published_protocol_change() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE v_status text;
            BEGIN
                SELECT status INTO v_status FROM assessment_versions
                 WHERE id = COALESCE(OLD.assessment_version_id, NEW.assessment_version_id);
                IF v_status IS DISTINCT FROM 'draft' THEN
                    RAISE EXCEPTION 'assessment version is % and its definition is immutable', v_status
                        USING ERRCODE = 'P0001';
                END IF;
                RETURN COALESCE(NEW, OLD);
            END $$;
        SQL);

        foreach (self::APPEND_ONLY as $table) {
            DB::unprepared("CREATE TRIGGER {$table}_append_only BEFORE UPDATE ON {$table} FOR EACH ROW EXECUTE FUNCTION forbid_update()");
        }

        foreach (['assessment_protocols', 'validation_rules', 'stimulus_assets'] as $table) {
            DB::unprepared("CREATE TRIGGER {$table}_immutable BEFORE UPDATE OR DELETE ON {$table} FOR EACH ROW EXECUTE FUNCTION forbid_published_protocol_change()");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }
        foreach (self::APPEND_ONLY as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_append_only ON {$table}");
        }
        foreach (['assessment_protocols', 'validation_rules', 'stimulus_assets'] as $table) {
            DB::unprepared("DROP TRIGGER IF EXISTS {$table}_immutable ON {$table}");
        }
        DB::unprepared('DROP FUNCTION IF EXISTS forbid_update(); DROP FUNCTION IF EXISTS forbid_published_protocol_change();');
    }
};
