<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Domain E — raw events. Append-only (enforced by triggers in a later
 * migration). Times are DOUBLE PRECISION milliseconds on the session clock;
 * planned and actual presentation times are kept separately.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('event_batches', function (Blueprint $table) {
            $table->uuid('id')->primary(); // client-generated batch_id (idempotency key)
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->unsignedInteger('first_sequence');
            $table->unsignedInteger('last_sequence');
            $table->unsignedInteger('event_count');
            $table->char('payload_sha256', 64);
            $table->string('engine_version', 32);
            $table->string('status', 16)->default('accepted');
            $table->timestamp('received_at')->useCurrent();
            $table->unique(['session_id', 'first_sequence']);
        });

        Schema::create('stimulus_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->foreignUuid('batch_id')->constrained('event_batches')->cascadeOnDelete();
            $table->unsignedInteger('sequence_number');
            $table->unsignedSmallInteger('block_index');
            $table->unsignedInteger('trial_index');
            $table->string('stimulus_code', 128);
            $table->string('modality', 16);
            $table->boolean('is_target');
            $table->double('planned_time_ms');
            $table->double('actual_present_time_ms');
            $table->double('logged_time_ms');
            $table->unsignedInteger('frame_number')->nullable();
            $table->string('presentation_status', 16);
            $table->unique(['session_id', 'sequence_number']);
        });

        Schema::create('response_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->foreignUuid('batch_id')->constrained('event_batches')->cascadeOnDelete();
            $table->foreignId('stimulus_event_id')->nullable()->constrained('stimulus_events')->cascadeOnDelete();
            $table->unsignedInteger('sequence_number');
            $table->unsignedInteger('stimulus_sequence')->nullable();
            $table->string('response_type', 128); // key code / mouse button
            $table->string('input_type', 16);
            $table->double('received_time_ms');
            $table->double('logged_time_ms');
            $table->double('reaction_time_ms')->nullable();
            $table->string('validity_status', 16);
            $table->unique(['session_id', 'sequence_number']);
        });

        // Lifecycle, block, environment and diagnostic events.
        Schema::create('session_events', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('tenant_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('session_id')->constrained('test_sessions')->cascadeOnDelete();
            $table->foreignUuid('batch_id')->constrained('event_batches')->cascadeOnDelete();
            $table->unsignedInteger('sequence_number');
            $table->string('event_type', 32);
            $table->double('logged_time_ms');
            $table->jsonb('payload');
            $table->unique(['session_id', 'sequence_number']);
            $table->index(['session_id', 'event_type']);
        });
    }

    public function down(): void
    {
        foreach (['session_events', 'response_events', 'stimulus_events', 'event_batches'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
