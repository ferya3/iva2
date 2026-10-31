<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Age eligibility of an assessment version (e.g. a shorter, slower variant
 * for young children). New sessions pick the published version whose range
 * contains the patient's age. Eligibility is metadata, not part of the
 * immutable protocol, so it stays editable after publishing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessment_versions', function (Blueprint $table) {
            $table->unsignedSmallInteger('min_age_years')->nullable()->after('min_engine_version');
            $table->unsignedSmallInteger('max_age_years')->nullable()->after('min_age_years');
            $table->string('audience_label', 64)->nullable()->after('max_age_years');
        });
    }

    public function down(): void
    {
        Schema::table('assessment_versions', function (Blueprint $table) {
            $table->dropColumn(['min_age_years', 'max_age_years', 'audience_label']);
        });
    }
};
