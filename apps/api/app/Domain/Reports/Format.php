<?php

namespace App\Domain\Reports;

use NumberFormatter;

/** Persian number formatting for report rendering (mirrors report-schema/format.ts). */
final class Format
{
    public static function metric(?float $value, ?string $unit): string
    {
        if ($value === null) {
            return '—';
        }
        $fa = new NumberFormatter('fa_IR', NumberFormatter::DECIMAL);
        $fa->setAttribute(NumberFormatter::MAX_FRACTION_DIGITS, 2);

        return match ($unit) {
            'ratio' => (new NumberFormatter('fa_IR', NumberFormatter::PERCENT))->format($value),
            'ms' => $fa->format($value).' میلی‌ثانیه',
            'ms/block' => $fa->format($value).' ms/بلوک',
            default => $fa->format($value),
        };
    }

    public static function digits(int|string|null $value): string
    {
        return $value === null ? '—' : strtr((string) $value, ['0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹']);
    }

    public static function validity(string $status): string
    {
        return ['valid' => 'معتبر', 'questionable' => 'نیازمند بررسی', 'invalid' => 'نامعتبر'][$status] ?? $status;
    }
}
