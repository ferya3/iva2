<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Domain D — test sessions, player credentials, device and calibration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('assessment_version_id')->constrained();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 16)->default('CREATED');
            $table->unsignedBigInteger('seed')->nullable();
            $table->string('engine_version', 32)->nullable();
            // Highest gap-free event sequence stored; the ingest cursor.
            $table->unsignedInteger('last_sequence')->default(0);
            // Announced by the player on completion; null while running.
            $table->unsignedInteger('expected_final_sequence')->nullable();
            $table->string('validity_status', 16)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'patient_id']);
            $table->index(['tenant_id', 'created_at']);
        });

        Schema::create('session_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->string('kind', 16); // invite | access
            $table->char('token_hash', 64)->unique();
            $table->timestamp('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->string('device_id', 64)->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamps();
            $table->index(['session_id', 'kind']);
        });

        Schema::create('device_profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->jsonb('device_info');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('calibration_results', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->string('verdict', 8);
            $table->double('refresh_rate_hz')->nullable();
            $table->jsonb('result');
            $table->timestamp('created_at')->useCurrent();
            $table->index('session_id');
        });

        // Append-only history of every status transition.
        Schema::create('session_states', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->string('from_status', 16)->nullable();
            $table->string('to_status', 16);
            $table->string('actor_type', 16); // user | player | system
            $table->string('actor_id', 64)->nullable();
            $table->string('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['session_id', 'id']);
        });
    }

    public function down(): void
    {
        foreach (['session_states', 'calibration_results', 'device_profiles', 'session_tokens', 'test_sessions'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
