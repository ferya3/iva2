import type { Metadata } from 'next';
import Link from 'next/link';
import { Download, FileText, RotateCcw } from 'lucide-react';
import { SESSION_STATUS_META, type SessionStatus } from '@cognitest/shared-types';
import {
  Alert,
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  SessionStatusBadge,
  faDateTime,
  faNumber,
} from '@cognitest/ui';
import { ApiRequestError, api } from '@/lib/api';
import { can } from '@/lib/auth';
import type { Results, Session } from '@/lib/types';
import { InvitePanel } from '@/features/sessions/invite-panel';
import { ResultsView } from '@/features/sessions/results-view';
import { ActionButton } from '@/features/sessions/action-button';
import { cancelSession, generateReport, rescoreSession } from '@/features/sessions/actions';

export const metadata: Metadata = { title: 'جلسه آزمون' };

const PLAYER_STEPS: SessionStatus[] = [
  'INVITED',
  'DEVICE_CHECK',
  'CALIBRATION',
  'READY',
  'RUNNING',
  'UPLOADING',
  'COMPLETED',
  'VALIDATED',
  'REPORTED',
];
const CANCELLABLE: SessionStatus[] = ['CREATED', 'INVITED', 'DEVICE_CHECK', 'CALIBRATION', 'READY'];

async function optional<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiRequestError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

export default async function SessionPage({ params, searchParams }: PageProps<'/sessions/[id]'>) {
  const { id } = await params;
  const { invite } = await searchParams;
  const { data: s } = await api<{ data: Session }>(`/sessions/${id}`);
  const hasResults = ['VALIDATED', 'REPORTED', 'INVALID'].includes(s.status);
  const [results, report, canManage, canReport] = await Promise.all([
    hasResults ? optional(api<Results>(`/sessions/${id}/results`)) : null,
    s.status === 'REPORTED'
      ? optional(
          api<{
            data: { id: string; report_version: number; pdf_ready: boolean; created_at: string };
          }>(`/sessions/${id}/report`),
        )
      : null,
    can('sessions.manage'),
    can('reports.generate'),
  ]);
  const stepIndex = PLAYER_STEPS.indexOf(s.status);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {s.assessment?.name ?? 'جلسه آزمون'} <SessionStatusBadge status={s.status} />
          </span>
        }
        description={
          <>
            مراجعه‌کننده{' '}
            <Link href={`/patients/${s.patient_id}`} className="ltr text-brand-700 hover:underline">
              {s.patient?.patient_code}
            </Link>
            {' · '}نسخه <span className="ltr">{s.assessment?.version}</span> · ایجاد{' '}
            {faDateTime(s.created_at)}
          </>
        }
      />

      {s.assessment && !s.assessment.is_clinical ? (
        <Alert tone="warning" className="mb-6">
          این نسخه آزمون غیربالینی (نمایشی/پژوهشی) است و نتایج آن نباید برای تشخیص استفاده شود.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {hasResults && results ? <ResultsView results={results} /> : null}
          {hasResults && !results ? <Alert tone="info">نتایج در حال آماده‌سازی است.</Alert> : null}

          {['CREATED', 'INVITED'].includes(s.status) && canManage ? (
            <Card>
              <CardHeader
                title="اجرای آزمون"
                description="کد ورود را در برنامه دسکتاپ وارد کنید."
              />
              <CardBody>
                <InvitePanel sessionId={s.id} canReissue autoIssue={invite === '1'} />
              </CardBody>
            </Card>
          ) : null}

          {['DEVICE_CHECK', 'CALIBRATION', 'READY', 'RUNNING', 'UPLOADING', 'COMPLETED'].includes(
            s.status,
          ) ? (
            <Card>
              <CardHeader title="پیشرفت جلسه" />
              <CardBody className="space-y-2 text-sm">
                <p>{SESSION_STATUS_META[s.status].fa}</p>
                {s.status === 'UPLOADING' ? (
                  <p className="text-slate-600">
                    رویدادهای دریافت‌شده: {faNumber(s.last_sequence)} از{' '}
                    {faNumber(s.expected_final_sequence)} — برنامه آزمون پس از اتصال مجدد، باقی
                    داده‌ها را ارسال می‌کند.
                  </p>
                ) : null}
                {s.calibration ? (
                  <p className="text-slate-600">
                    کالیبراسیون:{' '}
                    {s.calibration.verdict === 'fail'
                      ? 'رد'
                      : s.calibration.verdict === 'warn'
                        ? 'قابل قبول با هشدار'
                        : 'موفق'}{' '}
                    · {faNumber(Math.round(s.calibration.refresh_rate_hz))} هرتز
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="گزارش" />
            <CardBody className="space-y-3">
              {report ? (
                <>
                  <p className="text-sm text-slate-600">
                    نسخه {faNumber(report.data.report_version)} ·{' '}
                    {faDateTime(report.data.created_at)}
                  </p>
                  {report.data.pdf_ready ? (
                    <a
                      href={`/api/reports/${report.data.id}/download`}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      <Download className="h-4 w-4" /> دریافت PDF
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500">
                      فایل PDF در حال تولید است؛ صفحه را به‌روزرسانی کنید.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">گزارشی صادر نشده است.</p>
              )}
              {canReport && ['VALIDATED', 'REPORTED'].includes(s.status) ? (
                <ActionButton
                  action={generateReport.bind(null, s.id)}
                  variant={report ? 'secondary' : 'primary'}
                  pendingText="در حال صدور…"
                >
                  <FileText className="h-4 w-4" /> {report ? 'صدور نسخه جدید گزارش' : 'صدور گزارش'}
                </ActionButton>
              ) : null}
              {canReport && hasResults ? (
                <ActionButton action={rescoreSession.bind(null, s.id)} variant="ghost" size="sm">
                  <RotateCcw className="h-4 w-4" /> تحلیل مجدد داده خام
                </ActionButton>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="روند جلسه" />
            <CardBody>
              <ol className="space-y-3">
                {PLAYER_STEPS.map((step, i) => {
                  const done = stepIndex >= i;
                  const at = s.history?.find((h) => h.to === step)?.at;
                  return (
                    <li key={step} className="flex items-center gap-3 text-sm">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${done ? 'bg-brand-600' : 'bg-slate-200'}`}
                      />
                      <span className={done ? 'text-slate-900' : 'text-slate-400'}>
                        {SESSION_STATUS_META[step].fa}
                      </span>
                      {at ? (
                        <span className="ms-auto text-xs text-slate-400">{faDateTime(at)}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {['INVALID', 'CANCELLED', 'EXPIRED'].includes(s.status) ? (
                <Alert tone="danger" className="mt-4">
                  {SESSION_STATUS_META[s.status].fa}: {s.history?.at(-1)?.reason ?? '—'}
                </Alert>
              ) : null}
            </CardBody>
          </Card>

          {canManage && CANCELLABLE.includes(s.status) ? (
            <ActionButton
              action={cancelSession.bind(null, s.id)}
              variant="danger"
              confirm="جلسه لغو شود؟ کدهای ورود باطل می‌شوند."
            >
              لغو جلسه
            </ActionButton>
          ) : null}
        </div>
      </div>
    </>
  );
}
