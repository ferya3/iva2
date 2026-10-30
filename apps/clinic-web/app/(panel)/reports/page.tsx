import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Card,
  EmptyState,
  PageHeader,
  SessionStatusBadge,
  Table,
  Td,
  Th,
  ValidityBadge,
  faDateTime,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Paginated, Session } from '@/lib/types';

export const metadata: Metadata = { title: 'نتایج و گزارش‌ها' };

export default async function ReportsPage() {
  const [validated, reported] = await Promise.all([
    api<Paginated<Session>>('/sessions', { query: { status: 'VALIDATED', per_page: 50 } }),
    api<Paginated<Session>>('/sessions', { query: { status: 'REPORTED', per_page: 50 } }),
  ]);
  const rows = [...validated.data, ...reported.data].sort((a, b) =>
    (b.completed_at ?? '').localeCompare(a.completed_at ?? ''),
  );

  return (
    <>
      <PageHeader
        title="نتایج و گزارش‌ها"
        description="جلسات تحلیل‌شده؛ برای صدور یا دریافت گزارش روی هر جلسه کلیک کنید."
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="هنوز نتیجه‌ای آماده نشده است" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>مراجعه‌کننده</Th>
                <Th>آزمون</Th>
                <Th>اعتبار اجرا</Th>
                <Th>وضعیت گزارش</Th>
                <Th>تاریخ اجرا</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/sessions/${s.id}`}
                      className="ltr font-medium text-brand-700 hover:underline"
                    >
                      {s.patient?.patient_code}
                    </Link>
                  </Td>
                  <Td>{s.assessment?.name}</Td>
                  <Td>
                    <ValidityBadge status={s.validity_status} />
                  </Td>
                  <Td>
                    <SessionStatusBadge status={s.status} />
                  </Td>
                  <Td>{faDateTime(s.completed_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
