@php use App\Domain\Reports\Format; @endphp
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>گزارش {{ $doc['patient']['code'] }}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Vazirmatn', 'Vazir', Tahoma, sans-serif; color: #0f172a; font-size: 11pt; line-height: 1.7; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f766e; padding-bottom: 8px; margin-bottom: 14px; }
  header h1 { font-size: 17pt; margin: 0; color: #0f766e; }
  header .meta { font-size: 9pt; color: #475569; text-align: left; direction: ltr; white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
  .grid div span { display: block; color: #64748b; font-size: 8.5pt; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 700; font-size: 9.5pt; }
  .valid { background: #dcfce7; color: #166534; } .questionable { background: #fef9c3; color: #854d0e; } .invalid { background: #fee2e2; color: #991b1b; }
  h2 { font-size: 12.5pt; margin: 16px 0 6px; color: #134e4a; }
  .metrics { break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border-bottom: 1px solid #e2e8f0; padding: 5px 8px; text-align: right; }
  th { background: #f1f5f9; font-weight: 600; font-size: 9.5pt; }
  td.num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .flags li { margin-bottom: 2px; }
  .disclaimer { margin-top: 18px; border-top: 1px solid #cbd5e1; padding-top: 8px; font-size: 8.5pt; color: #475569; }
  .warning { background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; font-size: 9.5pt; }
  .norms { background: #f0fdfa; border: 1px solid #99f6e4; color: #134e4a; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; font-size: 9.5pt; }
  .band { font-size: 9pt; font-weight: 600; }
  .very_low, .low { color: #b91c1c; } .average { color: #334155; } .high, .very_high { color: #15803d; }
</style>
</head>
<body>
<header>
  <div>
    <h1>گزارش ارزیابی — {{ $doc['session']['assessment_name'] }}</h1>
    <div>{{ $doc['tenant']['name'] }}</div>
  </div>
  <div class="meta">
    v{{ $doc['report_version'] }} · {{ $doc['scoring']['algorithm_version'] }}<br>
    {{ \Illuminate\Support\Carbon::parse($doc['generated_at'])->format('Y-m-d H:i') }} UTC
  </div>
</header>

@unless($doc['session']['is_clinical'])
  <div class="warning">{{ __('metrics.non_clinical', [], $doc['locale'] ?? 'fa') }}</div>
@endunless

<section class="grid">
  <div><span>کد مراجع</span>{{ $doc['patient']['code'] }}</div>
  <div><span>سن</span>{{ Format::digits($doc['patient']['age_years']) }}</div>
  <div><span>نسخه آزمون</span>{{ $doc['session']['assessment_version'] }}@if(!empty($doc['session']['audience'])) <small>({{ $doc['session']['audience'] }})</small>@endif</div>
  <div><span>اعتبار اجرا</span><b class="badge {{ $doc['quality']['validity_status'] }}">{{ Format::validity($doc['quality']['validity_status']) }}</b></div>
  <div><span>شروع</span>{{ $doc['session']['started_at'] ? \Illuminate\Support\Carbon::parse($doc['session']['started_at'])->format('Y-m-d H:i') : '—' }}</div>
  <div><span>نرخ نوسازی نمایشگر</span>{{ isset($doc['session']['device']['refresh_rate_hz']) ? Format::metric($doc['session']['device']['refresh_rate_hz'], null).' Hz' : '—' }}</div>
  <div><span>کالیبراسیون</span>{{ $doc['session']['device']['calibration_verdict'] ?? '—' }}</div>
  <div><span>نسخه موتور</span>{{ $doc['session']['engine_version'] ?? '—' }}</div>
</section>

@if(!empty($doc['norms']))
  <div class="norms">
    مقایسه با هم‌سالان: هنجار «{{ $doc['norms']['name'] }}» (نسخه {{ $doc['norms']['version'] }})، سن مراجع {{ Format::digits($doc['norms']['age_years']) }} سال
    @if($doc['norms']['sex'] === 'female') · دختران/زنان @elseif($doc['norms']['sex'] === 'male') · پسران/مردان @endif
    @if($doc['norms']['provisional']) · <b>هنجار مقدماتی</b> @endif
  </div>
@endif

@if(count($doc['quality']['flags']))
  <h2>کنترل کیفیت اجرا</h2>
  <ul class="flags">
    @foreach($doc['quality']['flags'] as $flag)
      <li><b>{{ $flag['severity'] === 'critical' ? 'بحرانی' : ($flag['severity'] === 'warning' ? 'هشدار' : 'اطلاع') }}:</b> {{ $flag['message'] }}</li>
    @endforeach
  </ul>
@endif

@foreach($doc['sections'] as $section)
@php $normed = collect($section['metrics'])->contains(fn ($m) => !empty($m['norm'])); @endphp
<section class="metrics">
  <h2>{{ $section['title'] }}</h2>
  <table>
    <thead><tr>
      <th>شاخص</th><th style="width: {{ $normed ? '22' : '34' }}%">مقدار</th>
      @if($normed)<th style="width: 14%">نمرهٔ استاندارد</th><th style="width: 10%">صدک</th><th style="width: 20%">نسبت به هم‌سالان</th>@endif
    </tr></thead>
    <tbody>
    @foreach($section['metrics'] as $m)
      <tr>
        <td>{{ $m['label'] }}</td><td class="num">{{ Format::metric($m['value'], $m['unit']) }}</td>
        @if($normed)
          @if(!empty($m['norm']))
            <td class="num">{{ Format::digits($m['norm']['standard_score']) }}</td>
            <td class="num">{{ Format::metric($m['norm']['percentile'], null) }}</td>
            <td><span class="band {{ $m['norm']['band'] }}">{{ $m['norm']['band_label'] }}</span></td>
          @else
            <td class="num">—</td><td class="num">—</td><td>—</td>
          @endif
        @endif
      </tr>
    @endforeach
    </tbody>
  </table>
</section>
@endforeach

<div class="disclaimer">
  @foreach($doc['disclaimers'] as $line)<p>{{ $line }}</p>@endforeach
</div>
</body>
</html>
