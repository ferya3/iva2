import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ClipboardCheck, Hourglass, Stethoscope } from 'lucide-react';
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  SessionStatusBadge,
  StatCard,
  Table,
  Td,
  Th,
  ValidityBadge,
  buttonVariants,
  faDate,
  faDateTime,
  faNumber,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/types';

export const metadata: Metadata = { title: 'داشبورد' };

export default async function DashboardPage() {
  const d = await api<Dashboard>('/dashboard');
  const quota = d.subscription?.sessions_per_month;
  return (
    <>
      <PageHeader
        title="داشبورد"
        description="نمای کلی فعالیت کلینیک"
        actions={
          <Link href="/sessions/new" className={buttonVariants()}>
            آزمون جدید
          </Link>
        }
      />
      {!d.subscription ? (
        <Alert tone="warning" title="اشتراک فعال ندارید" className="mb-6">
          برای ایجاد جلسه آزمون، اشتراک کلینیک را از بخش «اشتراک و پرداخت» فعال کنید.
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مراجعان"
          value={faNumber(d.patients)}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="آزمون‌های انجام‌شده"
          value={faNumber(d.completed_sessions)}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          label="جلسات در انتظار"
          value={faNumber(d.pending_sessions)}
          icon={<Hourglass className="h-5 w-5" />}
          hint={
            quota
              ? `${faNumber(d.sessions_this_month)} از ${faNumber(quota)} جلسه این ماه`
              : undefined
          }
        />
        <StatCard
          label="متخصصان"
          value={faNumber(d.clinicians)}
          icon={<Stethoscope className="h-5 w-5" />}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="آخرین جلسات"
          action={
            <Link href="/sessions" className="text-sm text-brand-700 hover:underline">
              همه جلسات
            </Link>
          }
        />
        {d.recent_sessions.length === 0 ? (
          <EmptyState
            title="هنوز جلسه‌ای ثبت نشده است"
            description="یک مراجعه‌کننده ثبت کنید و اولین آزمون را بسازید."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>مراجعه‌کننده</Th>
                <Th>وضعیت</Th>
                <Th>اعتبار اجرا</Th>
                <Th>تاریخ</Th>
              </tr>
            </thead>
            <tbody>
              {d.recent_sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      <span className="ltr">{s.patient_code}</span>
                    </Link>
                  </Td>
                  <Td>
                    <SessionStatusBadge status={s.status} />
                  </Td>
                  <Td>
                    <ValidityBadge status={s.validity_status} />
                  </Td>
                  <Td title={faDateTime(s.created_at)}>{faDate(s.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
