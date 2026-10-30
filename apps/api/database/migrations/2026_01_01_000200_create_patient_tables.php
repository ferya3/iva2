<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Domain B — patients. Identity data (patient_profiles, guardians) is kept
 * apart from the pseudonymous patient record that test data references.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('patient_code', 32);
            // Stable pseudonym for statistics/exports; never derived from identity.
            $table->uuid('pseudonym')->unique();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['tenant_id', 'patient_code']);
        });

        Schema::create('patient_profiles', function (Blueprint $table) {
            $table->foreignUuid('patient_id')->primary()->constrained()->cascadeOnDelete();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->string('first_name', 100)->nullable();
            $table->string('last_name', 100)->nullable();
            $table->text('national_id')->nullable(); // encrypted
            $table->string('national_id_hash', 64)->nullable(); // HMAC blind index
            $table->date('birth_date')->nullable();
            $table->string('sex', 8)->nullable();
            $table->string('handedness', 16)->nullable();
            $table->string('education', 32)->nullable();
            $table->text('phone')->nullable(); // encrypted
            $table->jsonb('metadata')->default('{}');
            $table->timestamps();
            $table->index(['tenant_id', 'national_id_hash']);
            $table->index(['tenant_id', 'last_name']);
        });

        Schema::create('guardians', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('patient_id')->constrained()->cascadeOnDelete();
            $table->string('full_name', 200);
            $table->string('relation', 32);
            $table->text('phone')->nullable(); // encrypted
            $table->timestamps();
        });

        Schema::create('consents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('patient_id')->constrained()->cascadeOnDelete();
            $table->string('consent_type', 32);
            $table->string('version', 16);
            $table->string('accepted_by_name', 200);
            $table->timestamp('accepted_at');
            $table->timestamp('revoked_at')->nullable();
            $table->foreignUuid('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['patient_id', 'consent_type']);
        });

        Schema::create('patient_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('content'); // encrypted
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['patient_notes', 'consents', 'guardians', 'patient_profiles', 'patients'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
