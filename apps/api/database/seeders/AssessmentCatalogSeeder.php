<?php

namespace Database\Seeders;

use App\Models\AssessmentProtocol;
use App\Models\AssessmentType;
use App\Models\AssessmentVersion;
use App\Models\ScoringVersion;
use App\Models\ValidationRule;
use Illuminate\Database\Seeder;

/**
 * Seeds the generic demo CPT (non-clinical) in two age versions. The protocol JSON is exported
 * from packages/assessment-engine by scripts/export-demo-protocol.ts.
 */
class AssessmentCatalogSeeder extends Seeder
{
    /** file => [estimated seconds, min age, max age, audience label] */
    private const VERSIONS = [
        'demo-cpt.protocol.json' => [420, 9, null, 'نوجوانان و بزرگسالان'],
        'demo-cpt-child.protocol.json' => [330, 6, 8, 'کودکان ۶ تا ۸ سال'],
    ];

    public function run(): void
    {
        $type = AssessmentType::query()->updateOrCreate(['key' => 'demo-cpt'], [
            'name' => 'آزمون عملکرد پیوسته دیداری-شنیداری اعداد ۱ و ۲ (نمایشی)',
            'name_en' => 'Audio-visual digit CPT (demo)',
            'category' => 'attention',
            'description' => 'آزمون Go/No-Go عمومی با عدد ۱ (پاسخ) و ۲ (عدم پاسخ)، نوشتاری و گفتاری؛ نسخهٔ کودک (۶ تا ۸ سال) کوتاه‌تر و آهسته‌تر است. برای اعتبارسنجی فنی و نمایش؛ غیربالینی و فاقد هنجار.',
        ]);

        $current = [];
        foreach (self::VERSIONS as $file => [$seconds, $minAge, $maxAge, $audience]) {
            $protocol = json_decode(file_get_contents(__DIR__.'/data/'.$file), true, flags: JSON_THROW_ON_ERROR);
            $version = $type->versions()->where('version', $protocol['version'])->first()
                ?? $this->publish($type, $protocol, $seconds);
            // Eligibility is metadata: set it on versions published before age ranges existed.
            if ($version->min_age_years === null && $version->max_age_years === null) {
                $version->update(['min_age_years' => $minAge, 'max_age_years' => $maxAge, 'audience_label' => $audience]);
            }
            $current[] = $version->id;
        }

        // New sessions use the current versions; existing sessions keep theirs.
        $type->versions()->whereNotIn('id', $current)->where('status', 'published')->update(['status' => 'retired']);
    }

    private function publish(AssessmentType $type, array $protocol, int $seconds): AssessmentVersion
    {
        $version = AssessmentVersion::create([
            'assessment_type_id' => $type->id,
            'version' => $protocol['version'],
            'status' => 'draft',
            'is_clinical' => false,
            'estimated_duration_seconds' => $seconds,
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

        return $version;
    }
}
