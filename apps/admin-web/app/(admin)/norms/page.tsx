import {
  Alert,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  faDate,
  faNumber,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import { ActionButton } from '@/components/action-button';
import { changeNormSet } from '@/features/norms/actions';
import { NormUploadForm } from '@/features/norms/norm-upload-form';

export const metadata = { title: 'هنجارها و داده پژوهشی' };

interface NormSet {
  id: string;
  name: string;
  version: string;
  status: 'draft' | 'published' | 'retired';
  provisional: boolean;
  source: string | null;
  entries_count: number;
  assessment: { name: string; version: string; audience: string | null };
  coverage: {
    metrics: string[];
    age_min_years: number | null;
    age_max_years: number | null;
    sexes: string[];
    min_n: number | null;
  };
  published_at: string | null;
  created_at: string;
}
interface Version {
  id: string;
  version: string;
  status: string;
  audience_label: string | null;
  age_range_label: string | null;
}
interface ResearchSummary {
  total_sessions: number;
  eligible_sessions: number;
  participants: number;
  by_age: Array<{ age_years: number; male: number; female: number; other: number; total: number }>;
}

const STATUS = {
  draft: { fa: 'پیش‌نویس', tone: 'neutral' },
  published: { fa: 'فعال', tone: 'success' },
  retired: { fa: 'بازنشسته', tone: 'warning' },
} as const;
/** Rule of thumb for a stable mean/SD per band and sex. */
const MIN_PER_BAND = 30;

export default async function NormsPage() {
  const [{ data: sets }, { data: types }] = await Promise.all([
    api<{ data: NormSet[] }>('/admin/norm-sets'),
    api<{ data: Array<{ name: string; versions: Version[] }> }>('/admin/assessments'),
  ]);
  const versions = types.flatMap((t) =>
    t.versions
      .filter((v) => v.status === 'published')
      .map((v) => ({
        ...v,
        label: `${t.name} — ${v.audience_label ?? v.version}${v.age_range_label && !/[0-9۰-۹]/.test(v.audience_label ?? '') ? ` (${v.age_range_label})` : ''}`,
      })),
  );
  const summaries = await Promise.all(
    versions.map((v) =>
      api<{ data: ResearchSummary }>(`/admin/assessment-versions/${v.id}/research-summary`).then(
        (r) => r.data,
      ),
    ),
  );

  return (
    <>
      <PageHeader
        title="هنجارها و داده پژوهشی"
        description="نتایج هر مراجع با هم‌سالانش (هم‌سن و هم‌جنس) در هنجار فعال نسخهٔ آزمون او مقایسه می‌شود."
      />
      <Alert tone="info" className="mb-6">
        اعداد هنجار باید از یک مطالعهٔ هنجاریابی معتبر (نمونهٔ کافی در هر گروه سنی) به دست بیایند.
        داده‌های بی‌نام جلسه‌هایی که رضایت پژوهشی دارند در پایین همین صفحه برای تحلیل آماری قابل
        دریافت است.
      </Alert>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="مجموعه‌های هنجار" />
          {sets.length === 0 ? (
            <EmptyState
              title="هنوز هنجاری بارگذاری نشده است"
              description="تا زمانی که هنجار فعالی وجود نداشته باشد، گزارش‌ها فقط مقادیر خام را نشان می‌دهند."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>هنجار</Th>
                  <Th>نسخهٔ آزمون</Th>
                  <Th>پوشش</Th>
                  <Th>وضعیت</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {sets.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-medium text-slate-900">
                      {s.name} <span className="ltr text-xs text-slate-500">v{s.version}</span>
                      {s.provisional ? (
                        <Badge tone="warning" className="ms-2">
                          مقدماتی
                        </Badge>
                      ) : null}
                      {s.source ? (
                        <div className="max-w-xs truncate text-xs text-slate-500" title={s.source}>
                          {s.source}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      {s.assessment.audience ?? s.assessment.name}
                      <div className="ltr text-xs text-slate-500">{s.assessment.version}</div>
                    </Td>
                    <Td className="text-xs leading-6">
                      سن {faNumber(s.coverage.age_min_years)} تا{' '}
                      {faNumber(s.coverage.age_max_years)} · {faNumber(s.coverage.metrics.length)}{' '}
                      شاخص · {faNumber(s.entries_count)} سطر
                      <div
                        className={(s.coverage.min_n ?? 0) < MIN_PER_BAND ? 'text-amber-700' : ''}
                      >
                        کمترین نمونه در یک گروه: {faNumber(s.coverage.min_n)} نفر
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].fa}</Badge>
                      <div className="text-xs text-slate-500">
                        {faDate(s.published_at ?? s.created_at)}
                      </div>
                    </Td>
                    <Td className="space-y-2">
                      {s.status === 'draft' ? (
                        <>
                          <ActionButton
                            action={changeNormSet.bind(null, s.id, 'publish')}
                            size="sm"
                            confirm="این هنجار برای گزارش‌های جدید این نسخه استفاده می‌شود و دیگر قابل تغییر نیست. هنجار فعال قبلی بازنشسته می‌شود."
                          >
                            انتشار
                          </ActionButton>
                          <ActionButton
                            action={changeNormSet.bind(null, s.id, 'delete')}
                            size="sm"
                            variant="ghost"
                            confirm="پیش‌نویس حذف شود؟"
                          >
                            حذف
                          </ActionButton>
                        </>
                      ) : s.status === 'published' ? (
                        <ActionButton
                          action={changeNormSet.bind(null, s.id, 'retire')}
                          size="sm"
                          variant="ghost"
                          confirm="گزارش‌های جدید دیگر با این هنجار مقایسه نمی‌شوند (گزارش‌های قبلی تغییری نمی‌کنند)."
                        >
                          بازنشسته‌سازی
                        </ActionButton>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="بارگذاری هنجار" />
          <CardBody>
            <NormUploadForm versions={versions.map((v) => ({ id: v.id, label: v.label }))} />
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">
        داده‌های پژوهشی برای هنجاریابی
      </h2>
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        فقط جلسه‌های معتبرِ مراجعانی که رضایت پژوهشی دارند، بدون نام، کد ملی و نام کلینیک. هر مراجع
        با یک شناسهٔ تصادفی مشخص می‌شود تا آزمون‌های تکراری او قابل تشخیص باشد (ستون attempt).
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {versions.map((v, i) => {
          const s = summaries[i]!;
          return (
            <Card key={v.id}>
              <CardHeader
                title={v.label}
                description={
                  <>
                    {faNumber(s.participants)} مراجع · {faNumber(s.eligible_sessions)} جلسهٔ قابل
                    استفاده از {faNumber(s.total_sessions)} جلسهٔ تحلیل‌شده
                  </>
                }
                action={
                  s.eligible_sessions > 0 ? (
                    <a
                      href={`/research/${v.id}/export`}
                      className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      دریافت CSV
                    </a>
                  ) : null
                }
              />
              {s.by_age.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>سن</Th>
                      <Th>پسر/مرد</Th>
                      <Th>دختر/زن</Th>
                      <Th>نامشخص</Th>
                      <Th>جمع</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.by_age.map((row) => (
                      <tr key={row.age_years}>
                        <Td>{faNumber(row.age_years)} سال</Td>
                        <Td className="tabular-nums">{faNumber(row.male)}</Td>
                        <Td className="tabular-nums">{faNumber(row.female)}</Td>
                        <Td className="tabular-nums">{faNumber(row.other)}</Td>
                        <Td
                          className={`tabular-nums font-medium ${row.total < MIN_PER_BAND ? 'text-amber-700' : 'text-emerald-700'}`}
                        >
                          {faNumber(row.total)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <CardBody className="text-sm text-slate-500">
                  هنوز جلسهٔ معتبری با رضایت پژوهشی برای این نسخه ثبت نشده است.
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        رنگ سبز: دست‌کم {faNumber(MIN_PER_BAND)} نفر در آن سن (حداقل معمول برای برآورد پایدار
        میانگین و انحراف معیار).
      </p>
    </>
  );
}
