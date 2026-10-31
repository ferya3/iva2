<?php

namespace App\Domain\Norms;

use App\Domain\Scoring\MetricKeys;
use Illuminate\Validation\ValidationException;

/**
 * Parses norm tables uploaded by administrators. One row per metric, age
 * band and sex:
 *
 *   scope,metric_key,sex,age_min,age_max,mean,sd,n,direction
 *   overall,rt_mean,all,6,6,612.4,98.1,84,
 *
 * sex: all|male|female (empty = all); direction: higher_better|lower_better|
 * neutral (empty = the metric's default). Persian digits are accepted.
 * Errors are reported per line, in Persian, for the admin panel.
 */
final class NormCsv
{
    public const HEADER = ['scope', 'metric_key', 'sex', 'age_min', 'age_max', 'mean', 'sd', 'n', 'direction'];

    private const MAX_ROWS = 5000;

    /** @return list<array<string, mixed>> rows ready for NormEntry::create */
    public static function parse(string $csv): array
    {
        $csv = strtr(preg_replace('/^\xEF\xBB\xBF/', '', $csv), [
            '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4', '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4', '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '٫' => '.', '،' => ',',
        ]);
        $lines = preg_split('/\r\n|\r|\n/', trim($csv));
        $header = array_map(fn ($h) => strtolower(trim($h)), str_getcsv(array_shift($lines) ?? '', escape: ''));
        if ($header !== self::HEADER) {
            self::fail(['سطر اول باید دقیقاً این ستون‌ها باشد: '.implode(',', self::HEADER)]);
        }
        if (count($lines) > self::MAX_ROWS) {
            self::fail(['حداکثر '.self::MAX_ROWS.' سطر مجاز است.']);
        }

        $known = MetricKeys::ALL;
        $rows = [];
        $errors = [];
        foreach ($lines as $i => $line) {
            $lineNo = $i + 2;
            if (trim($line) === '') {
                continue;
            }
            $cells = array_map('trim', str_getcsv($line, escape: ''));
            if (count($cells) !== count(self::HEADER)) {
                $errors[] = "سطر {$lineNo}: باید ".count(self::HEADER).' ستون داشته باشد.';

                continue;
            }
            $r = array_combine(self::HEADER, $cells);
            $problems = [];
            if (! preg_match('/^(overall|visual|auditory|block:[a-z0-9_-]{1,10})$/', $r['scope'])) {
                $problems[] = "scope «{$r['scope']}» نامعتبر است (overall، visual یا auditory)";
            }
            if (! in_array($r['metric_key'], $known, true)) {
                $problems[] = "شاخص «{$r['metric_key']}» شناخته‌شده نیست";
            }
            $sex = $r['sex'] === '' ? 'all' : strtolower($r['sex']);
            if (! in_array($sex, ['all', 'male', 'female'], true)) {
                $problems[] = 'sex باید all، male یا female باشد';
            }
            $ageMin = filter_var($r['age_min'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 120]]);
            $ageMax = filter_var($r['age_max'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 120]]);
            if ($ageMin === false || $ageMax === false || $ageMax < $ageMin) {
                $problems[] = 'بازهٔ سنی نامعتبر است (عدد صحیح، age_min ≤ age_max)';
            }
            $mean = is_numeric($r['mean']) ? (float) $r['mean'] : null;
            $sd = is_numeric($r['sd']) ? (float) $r['sd'] : null;
            $n = filter_var($r['n'], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
            if ($mean === null || ! is_finite($mean)) {
                $problems[] = 'mean باید عدد باشد';
            }
            if ($sd === null || ! is_finite($sd) || $sd <= 0) {
                $problems[] = 'sd باید عددی بزرگ‌تر از صفر باشد';
            }
            if ($n === false) {
                $problems[] = 'n باید عدد صحیح مثبت باشد';
            }
            $direction = $r['direction'] === '' ? MetricDirection::defaultFor($r['metric_key']) : MetricDirection::tryFrom(strtolower($r['direction']));
            if ($direction === null) {
                $problems[] = 'direction باید higher_better، lower_better یا neutral باشد';
            }
            if ($problems !== []) {
                $errors[] = "سطر {$lineNo}: ".implode('؛ ', $problems).'.';

                continue;
            }
            $rows[] = [
                'line' => $lineNo,
                'scope' => $r['scope'],
                'metric_key' => $r['metric_key'],
                'sex' => $sex,
                'age_min_years' => $ageMin,
                'age_max_years' => $ageMax,
                'mean' => $mean,
                'sd' => $sd,
                'n' => $n,
                'direction' => $direction->value,
            ];
        }
        if ($errors === [] && $rows === []) {
            $errors[] = 'فایل هیچ سطر داده‌ای ندارد.';
        }
        $errors = [...$errors, ...self::overlaps($rows)];
        if ($errors !== []) {
            self::fail(array_slice($errors, 0, 50));
        }

        return array_map(fn ($r) => array_diff_key($r, ['line' => true]), $rows);
    }

    /** Age bands of the same metric/scope/sex must not overlap: a patient's score must be unambiguous. */
    private static function overlaps(array $rows): array
    {
        $errors = [];
        $groups = [];
        foreach ($rows as $r) {
            $groups["{$r['scope']}|{$r['metric_key']}|{$r['sex']}"][] = $r;
        }
        foreach ($groups as $group) {
            usort($group, fn ($a, $b) => $a['age_min_years'] <=> $b['age_min_years']);
            for ($i = 1; $i < count($group); $i++) {
                if ($group[$i]['age_min_years'] <= $group[$i - 1]['age_max_years']) {
                    $errors[] = "سطر {$group[$i]['line']}: بازهٔ سنی با سطر {$group[$i - 1]['line']} برای همین شاخص هم‌پوشانی دارد.";
                }
            }
        }

        return $errors;
    }

    private static function fail(array $messages): never
    {
        throw ValidationException::withMessages(['csv' => $messages]);
    }
}
