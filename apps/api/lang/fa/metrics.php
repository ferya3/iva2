<?php

// Keep in sync with METRIC_LABELS in packages/report-schema/src/format.ts.
return [
    'trials' => 'تعداد کوشش‌ها',
    'excluded_trials' => 'کوشش‌های کنارگذاشته',
    'targets' => 'محرک‌های هدف',
    'non_targets' => 'محرک‌های غیرهدف',
    'hits' => 'پاسخ صحیح',
    'omissions' => 'خطای حذف',
    'commissions' => 'خطای ارتکاب',
    'correct_rejections' => 'بازداری صحیح',
    'hit_rate' => 'نرخ پاسخ صحیح',
    'omission_rate' => 'نرخ خطای حذف',
    'commission_rate' => 'نرخ خطای ارتکاب',
    'anticipatory_responses' => 'پاسخ‌های پیش‌دستانه',
    'repeated_responses' => 'پاسخ‌های تکراری',
    'rt_mean' => 'میانگین زمان واکنش',
    'rt_median' => 'میانه زمان واکنش',
    'rt_sd' => 'انحراف معیار زمان واکنش',
    'rt_cv' => 'ضریب تغییرات زمان واکنش',
    'd_prime' => 'حساسیت (d′)',
    'criterion_c' => 'ملاک پاسخ (c)',
    'rt_mean_slope_per_block' => 'روند زمان واکنش در طول آزمون',
    'hit_rate_slope_per_block' => 'روند دقت در طول آزمون',

    'sections' => [
        'overview' => 'شاخص‌های کلی',
        'visual' => 'حوزه دیداری',
        'auditory' => 'حوزه شنیداری',
        'trend' => 'روند عملکرد در طول آزمون',
    ],

    'disclaimers' => [
        'این گزارش خروجی خودکار نرم‌افزار است و جایگزین قضاوت بالینی متخصص نیست.',
        'شاخص‌ها خام هستند و تا پیش از انجام مطالعه هنجاریابی، با هنجار جمعیتی مقایسه نشده‌اند.',
    ],
    'non_clinical' => 'این نسخه از آزمون غیربالینی (پژوهشی/نمایشی) است و نباید برای تشخیص استفاده شود.',
];
