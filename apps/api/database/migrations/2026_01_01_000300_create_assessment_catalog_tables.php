<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Domain C — the global, versioned assessment catalogue. A published
 * version is immutable: any parameter change requires a new version.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assessment_types', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('key', 64)->unique();
            $table->string('name');
            $table->string('name_en')->nullable();
            $table->string('category', 32)->index();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('assessment_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_type_id')->constrained()->cascadeOnDelete();
            $table->string('version', 32);
            $table->string('status', 16)->default('draft')->index();
            $table->boolean('is_clinical')->default(false);
            $table->unsignedInteger('estimated_duration_seconds')->default(0);
            $table->string('min_engine_version', 32)->default('1.0.0');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['assessment_type_id', 'version']);
        });

        Schema::create('assessment_protocols', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_version_id')->unique()->constrained()->cascadeOnDelete();
            $table->jsonb('config');
            $table->char('config_sha256', 64);
            $table->timestamps();
        });

        Schema::create('stimulus_assets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_version_id')->constrained()->cascadeOnDelete();
            $table->string('asset_key', 128);
            $table->string('disk', 32)->default('assets');
            $table->string('storage_path');
            $table->string('mime_type', 64);
            $table->char('sha256', 64);
            $table->unsignedBigInteger('size_bytes');
            $table->timestamps();
            $table->unique(['assessment_version_id', 'asset_key']);
        });

        Schema::create('scoring_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_version_id')->constrained()->cascadeOnDelete();
            $table->string('algorithm_version', 64);
            $table->jsonb('config')->default('{}');
            $table->boolean('is_default')->default(false);
            $table->timestamps();
            $table->unique(['assessment_version_id', 'algorithm_version']);
        });

        Schema::create('validation_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_version_id')->unique()->constrained()->cascadeOnDelete();
            $table->jsonb('rules');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['validation_rules', 'scoring_versions', 'stimulus_assets', 'assessment_protocols', 'assessment_versions', 'assessment_types'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
