<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Domain F — scoring runs, metrics, validity and reports. Every derived
 * artefact references the algorithm version that produced it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scoring_runs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->foreignUuid('scoring_version_id')->nullable()->constrained()->nullOnDelete();
            $table->string('algorithm_version', 64)->nullable();
            $table->string('status', 16)->default('pending');
            $table->char('input_sha256', 64)->nullable();
            $table->text('error')->nullable();
            $table->foreignUuid('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['session_id', 'created_at']);
        });

        Schema::create('scoring_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('scoring_run_id')->constrained()->cascadeOnDelete();
            $table->string('metric_key', 64);
            $table->string('scope', 64);
            $table->double('value')->nullable();
            $table->string('unit', 16)->nullable();
            $table->unique(['scoring_run_id', 'scope', 'metric_key']);
        });

        Schema::create('validity_results', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->foreignUuid('scoring_run_id')->constrained()->cascadeOnDelete();
            $table->string('validity_status', 16);
            $table->jsonb('flags')->default('[]');
            $table->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_note')->nullable();
            $table->timestamps();
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->foreignUuid('scoring_run_id')->constrained();
            $table->unsignedInteger('report_version');
            $table->string('status', 16)->default('final');
            $table->jsonb('content');
            $table->foreignUuid('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['session_id', 'report_version']);
        });

        Schema::create('report_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('report_id')->constrained()->cascadeOnDelete();
            $table->string('disk', 32);
            $table->string('storage_path');
            $table->string('mime_type', 64);
            $table->char('sha256', 64);
            $table->unsignedBigInteger('size_bytes');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('report_access_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('report_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action', 16); // view | download
            $table->string('ip', 45)->nullable();
            $table->timestamp('accessed_at')->useCurrent();
            $table->index(['report_id', 'accessed_at']);
        });
    }

    public function down(): void
    {
        foreach (['report_access_logs', 'report_files', 'reports', 'validity_results', 'scoring_metrics', 'scoring_runs'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
