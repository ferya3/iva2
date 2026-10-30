<?php

namespace Database\Seeders;

use App\Models\AssessmentProtocol;
use App\Models\AssessmentType;
use App\Models\AssessmentVersion;
use App\Models\ScoringVersion;
use App\Models\ValidationRule;
use Illuminate\Database\Seeder;

/**
 * Seeds the generic demo CPT (non-clinical). The protocol JSON is exported
 * from packages/assessment-engine by scripts/export-demo-protocol.ts.
 */
class AssessmentCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $protocol = json_decode(file_get_contents(__DIR__.'/data/demo-cpt.protocol.json'), true, flags: JSON_THROW_ON_ERROR);

        $type = AssessmentType::query()->updateOrCreate(['key' => 'demo-cpt'], [
            'name' => 'آزمون عملکرد پیوسته دیداری-شنیداری اعداد ۱ و ۲ (نمایشی)',
            'name_en' => 'Audio-visual digit CPT (demo)',
            'category' => 'attention',
            'description' => 'آزمون Go/No-Go عمومی با عدد ۱ (پاسخ) و ۲ (عدم پاسخ)، نوشتاری و گفتاری. برای اعتبارسنجی فنی و نمایش؛ غیربالینی و فاقد هنجار.',
        ]);

        if ($type->versions()->where('version', $protocol['version'])->exists()) {
            return; // published versions are immutable
        }

        $version = AssessmentVersion::create([
            'assessment_type_id' => $type->id,
            'version' => $protocol['version'],
            'status' => 'draft',
            'is_clinical' => false,
            'estimated_duration_seconds' => 420,
            // 1.1.0: recorded (spoken) stimuli bundled with the player.
            'min_engine_version' => '1.1.0',
        ]);
        AssessmentProtocol::create(['assessment_version_id' => $version->id, 'config' => $protocol]);
        ValidationRule::create(['assessment_version_id' => $version->id, 'rules' => [
            'calibration' => [
                'min_refresh_hz' => 59,
                'max_frame_sd_ms' => 2.0,
                'max_dropped_ratio' => 0.01,
                'max_input_dispatch_p95_ms' => 16,
                'require_audio' => true,
                'max_audio_output_latency_ms' => 120,
            ],
            'quality' => [
                'lateOnsetRatio' => ['warn' => 0.02, 'critical' => 0.1],
                'droppedStimulusRatio' => ['warn' => 0.001, 'critical' => 0.05],
                'frameDropEventsPerMinute' => ['warn' => 2, 'critical' => 20],
                'hiddenTimeMs' => ['warn' => 1, 'critical' => 10000],
                'focusLossCount' => ['warn' => 1, 'critical' => 5],
                'audioErrors' => ['warn' => 1, 'critical' => 3],
                'omissionRate' => ['warn' => 0.5, 'critical' => 0.9],
            ],
        ]]);
        ScoringVersion::create([
            'assessment_version_id' => $version->id,
            'algorithm_version' => 'generic-cpt/1.0.0',
            'config' => ['excludeLateOnsets' => false],
            'is_default' => true,
        ]);
        $version->update(['status' => 'published', 'published_at' => now()]);

        // New sessions use the new version; existing sessions keep theirs.
        $type->versions()->where('id', '!=', $version->id)->where('status', 'published')->update(['status' => 'retired']);
    }
}
