import { formatMetric, metricLabel } from '@cognitest/report-schema';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  Table,
  Td,
  Th,
  ValidityBadge,
  faDateTime,
} from '@cognitest/ui';
import type { Results } from '@/lib/types';
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

      <Card>
        <CardHeader
          title="جزئیات شاخص‌ها"
          description="مقادیر خام؛ تا پیش از هنجاریابی با جمعیت مرجع مقایسه نشده‌اند."
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
