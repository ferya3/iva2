<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Normative data (global, not tenant-owned). A norm set belongs to one
 * assessment version, because changing the protocol changes the scores.
 * Each entry is the mean/SD of one metric for one age band (and optionally
 * one sex) in the reference sample. Published sets are immutable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('norm_sets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('assessment_version_id')->constrained()->cascadeOnDelete();
            $table->string('name', 160);
            $table->string('version', 32);
            $table->string('status', 16)->default('draft')->index();
            // Pilot/preliminary norms: shown with a warning in reports.
            $table->boolean('provisional')->default(true);
            $table->text('source')->nullable();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['assessment_version_id', 'version']);
        });

        Schema::create('norm_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('norm_set_id')->constrained()->cascadeOnDelete();
            $table->string('scope', 16);
            $table->string('metric_key', 64);
            $table->string('sex', 8)->default('all'); // all | male | female
            $table->unsignedSmallInteger('age_min_years');
            $table->unsignedSmallInteger('age_max_years');
            $table->double('mean');
            $table->double('sd');
            $table->unsignedInteger('n');
            $table->string('direction', 16); // higher_better | lower_better
            $table->unique(['norm_set_id', 'scope', 'metric_key', 'sex', 'age_min_years'], 'norm_entries_band_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('norm_entries');
        Schema::dropIfExists('norm_sets');
    }
};
