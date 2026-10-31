import { NORM_BAND_LABELS, formatMetric, metricLabel } from '@cognitest/report-schema';
import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Table,
  Td,
  Th,
  ValidityBadge,
  faDateTime,
  faNumber,
} from '@cognitest/ui';
import type { NormScore, Results } from '@/lib/types';
import { BlockChart, type BlockPoint } from './block-chart';

const HEADLINE = ['hit_rate', 'commission_rate', 'rt_mean', 'rt_sd', 'd_prime'] as const;
const SCOPES = [
  { scope: 'overall', label: 'کلی' },
  { scope: 'visual', label: 'دیداری' },
  { scope: 'auditory', label: 'شنیداری' },
] as const;
const DETAIL = [
  'trials',
  'hits',
  'omissions',
  'commissions',
  'correct_rejections',
  'hit_rate',
  'omission_rate',
  'commission_rate',
  'rt_mean',
  'rt_median',
  'rt_sd',
  'rt_cv',
  'd_prime',
  'criterion_c',
  'anticipatory_responses',
  'repeated_responses',
];

const BAND_TONE = { bad: 'danger', warn: 'warning', ok: 'neutral', good: 'success' } as const;
const SCOPE_LABEL: Record<string, string> = {
  overall: 'کلی',
  visual: 'دیداری',
  auditory: 'شنیداری',
};

/** Position of a standard score on a 40–160 scale, with the average range (85–115) shaded. */
function ScoreBar({ score }: { score: number }) {
  const pct = (v: number) => `${((Math.min(160, Math.max(40, v)) - 40) / 120) * 100}%`;
  return (
    <div className="relative h-2 w-28 rounded-full bg-slate-100" aria-hidden>
      <div
        className="absolute inset-y-0 rounded-full bg-slate-200"
        style={{ insetInlineStart: pct(85), width: '25%' }}
      />
      <div
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-brand-600 ring-2 ring-white"
        style={{ insetInlineStart: `calc(${pct(score)} - 6px)` }}
      />
    </div>
  );
}

function NormsCard({ norms, results }: { norms: NonNullable<Results['norms']>; results: Results }) {
  const order = (n: NormScore & { key: string; scope: string }) =>
    Object.keys(SCOPE_LABEL).indexOf(n.scope) * 100 + DETAIL.indexOf(n.key);
  const sex =
    norms.sex === 'female' ? ' · دختران/زنان' : norms.sex === 'male' ? ' · پسران/مردان' : '';
  return (
    <Card>
      <CardHeader
        title="مقایسه با هم‌سالان"
        description={
          <>
            هنجار «{norms.name}» (نسخه {norms.version}) · سن {faNumber(norms.age_years)} سال{sex}
          </>
        }
        action={norms.provisional ? <Badge tone="warning">هنجار مقدماتی</Badge> : null}
      />
      {norms.provisional ? (
        <CardBody className="pb-0">
          <Alert tone="warning">
            این هنجار مقدماتی است (نمونهٔ محدود)؛ نمره‌ها را با احتیاط و همراه با سایر شواهد بالینی
            تفسیر کنید.
          </Alert>
        </CardBody>
      ) : null}
      <Table>
        <thead>
          <tr>
            <Th>شاخص</Th>
            <Th>حوزه</Th>
            <Th>مقدار</Th>
            <Th>نمرهٔ استاندارد</Th>
            <Th>صدک</Th>
            <Th>نسبت به هم‌سالان</Th>
          </tr>
        </thead>
        <tbody>
          {[...norms.scores]
            .sort((a, b) => order(a) - order(b))
            .map((n) => {
              const m = results.metrics.find((x) => x.key === n.key && x.scope === n.scope);
              const band = NORM_BAND_LABELS[n.band];
              return (
                <tr key={`${n.scope}:${n.key}`}>
                  <Td className="font-medium text-slate-800">{metricLabel(n.key)}</Td>
                  <Td>{SCOPE_LABEL[n.scope] ?? n.scope}</Td>
                  <Td className="tabular-nums">
                    {formatMetric(m?.value ?? null, m?.unit ?? null)}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-3 tabular-nums">
                      {faNumber(n.standard_score)}
                      <ScoreBar score={n.standard_score} />
                    </span>
                  </Td>
                  <Td className="tabular-nums">{faNumber(n.percentile)}</Td>
                  <Td>
                    <Badge tone={BAND_TONE[band.tone]}>{band.fa}</Badge>
                    <span className="mt-1 block text-xs text-slate-400">
                      گروه{' '}
                      {n.age_band
                        .split('–')
                        .map((d) => faNumber(Number(d)))
                        .join(' تا ')}{' '}
                      سال · نمونه {faNumber(n.n)}
                    </span>
                  </Td>
                </tr>
              );
            })}
        </tbody>
      </Table>
      <CardBody className="text-xs text-slate-500">
        نمرهٔ استاندارد: میانگین هم‌سالان ۱۰۰ و انحراف معیار ۱۵؛ نمرهٔ بالاتر یعنی عملکرد بهتر.
        محدودهٔ ۸۵ تا ۱۱۵ (نوار خاکستری) میانگین است.
      </CardBody>
    </Card>
  );
}

export function ResultsView({ results }: { results: Results }) {
  const get = (key: string, scope = 'overall') =>
    results.metrics.find((m) => m.key === key && m.scope === scope);
  const blocks: BlockPoint[] = [
    ...new Set(results.metrics.filter((m) => m.scope.startsWith('block:')).map((m) => m.scope)),
  ].map((scope) => ({
    block: scope.replace('block:', ''),
    rtMean: get('rt_mean', scope)?.value ?? null,
    hitRate: get('hit_rate', scope)?.value ?? null,
  }));
  const severityTone = { critical: 'danger', warning: 'warning', info: 'info' } as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="نتایج تحلیل"
          description={
            <>
              الگوریتم <span className="ltr">{results.algorithm_version}</span> ·{' '}
              {faDateTime(results.scored_at)}
            </>
          }
          action={<ValidityBadge status={results.validity_status} />}
        />
        <CardBody className="space-y-4">
          {results.quality_flags.map((f) => (
            <Alert
              key={f.code}
              tone={severityTone[f.severity]}
              title={f.severity === 'critical' ? 'خطای کنترل کیفیت' : 'هشدار کنترل کیفیت'}
            >
              {f.message} <span className="ltr text-xs opacity-70">({f.code})</span>
            </Alert>
          ))}
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {HEADLINE.map((key) => {
              const m = get(key);
              return (
                <div key={key} className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">{metricLabel(key)}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {formatMetric(m?.value ?? null, m?.unit ?? null)}
                  </p>
                </div>
              );
            })}
          </div>
          {blocks.length > 1 ? <BlockChart points={blocks} /> : null}
        </CardBody>
      </Card>

      {results.norms ? <NormsCard norms={results.norms} results={results} /> : null}

      <Card>
        <CardHeader
          title="جزئیات شاخص‌ها"
          description={
            results.norms
              ? 'مقادیر خام همهٔ شاخص‌ها.'
              : 'مقادیر خام؛ برای این نسخه و گروه سنی هنوز هنجاری منتشر نشده است.'
          }
        />
        <Table>
          <thead>
            <tr>
              <Th>شاخص</Th>
              {SCOPES.map((s) => (
                <Th key={s.scope}>{s.label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DETAIL.map((key) => (
              <tr key={key}>
                <Td className="font-medium text-slate-800">{metricLabel(key)}</Td>
                {SCOPES.map((s) => {
                  const m = get(key, s.scope);
                  return (
                    <Td key={s.scope} className="tabular-nums">
                      {formatMetric(m?.value ?? null, m?.unit ?? null)}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
