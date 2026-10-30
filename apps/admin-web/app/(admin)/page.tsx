import { SESSION_STATUS_META, type SessionStatus } from '@cognitest/shared-types';
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  SessionStatusBadge,
  StatCard,
  faNumber,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import { SessionsPerDayChart } from '@/components/stats-chart';

export const metadata = { title: 'نمای کلی' };

interface Stats {
  tenants: number;
  active_tenants: number;
  users: number;
  sessions: number;
  sessions_by_status: Record<SessionStatus, number>;
  sessions_per_day: Record<string, number>;
  active_subscriptions: number;
}

export default async function OverviewPage() {
  const s = await api<Stats>('/admin/stats');
  return (
    <>
      <PageHeader title="نمای کلی سامانه" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="کلینیک‌ها"
          value={faNumber(s.tenants)}
          hint={`${faNumber(s.active_tenants)} فعال`}
        />
        <StatCard label="اشتراک‌های فعال" value={faNumber(s.active_subscriptions)} />
        <StatCard label="کاربران" value={faNumber(s.users)} />
        <StatCard label="کل جلسات آزمون" value={faNumber(s.sessions)} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="جلسات ۳۰ روز اخیر" />
          <CardBody>
            <SessionsPerDayChart data={s.sessions_per_day} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="جلسات بر اساس وضعیت" />
          <CardBody>
            <ul className="space-y-2">
              {(Object.keys(SESSION_STATUS_META) as SessionStatus[]).map((status) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <SessionStatusBadge status={status} />
                  <span className="tabular-nums">
                    {faNumber(s.sessions_by_status[status] ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
