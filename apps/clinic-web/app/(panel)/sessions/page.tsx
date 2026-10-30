import type { Metadata } from 'next';
import Link from 'next/link';
import { SESSION_STATUS_META, SessionStatus } from '@cognitest/shared-types';
import {
  Card,
  EmptyState,
  PageHeader,
  SessionStatusBadge,
  Table,
  Td,
  Th,
  ValidityBadge,
  buttonVariants,
  cn,
  faDateTime,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Paginated, Session } from '@/lib/types';
import { Pagination } from '@/components/pagination';

export const metadata: Metadata = { title: 'جلسات آزمون' };

const FILTERS: Array<{ key: string; label: string; query: Record<string, string> }> = [
  { key: 'all', label: 'همه', query: {} },
  { key: 'pending', label: 'در جریان', query: { pending: '1' } },
  { key: 'VALIDATED', label: SESSION_STATUS_META.VALIDATED.fa, query: { status: 'VALIDATED' } },
  { key: 'REPORTED', label: SESSION_STATUS_META.REPORTED.fa, query: { status: 'REPORTED' } },
  { key: 'INVALID', label: SESSION_STATUS_META.INVALID.fa, query: { status: 'INVALID' } },
];

export default async function SessionsPage({ searchParams }: PageProps<'/sessions'>) {
  const params = await searchParams;
  const status =
    typeof params.status === 'string' &&
    Object.values(SessionStatus).includes(params.status as SessionStatus)
      ? params.status
      : undefined;
  const pending = params.pending === '1' ? '1' : undefined;
  const active = status ?? (pending ? 'pending' : 'all');
  const res = await api<Paginated<Session>>('/sessions', {
    query: { status, pending, page: typeof params.page === 'string' ? params.page : 1 },
  });

  return (
    <>
      <PageHeader
        title="جلسات آزمون"
        actions={
          <Link href="/sessions/new" className={buttonVariants()}>
            آزمون جدید
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/sessions?${new URLSearchParams(f.query)}`}
            className={cn(
              'rounded-full px-3 py-1 text-sm ring-1',
              active === f.key
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Card>
        {res.data.length === 0 ? (
          <EmptyState title="جلسه‌ای یافت نشد" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>مراجعه‌کننده</Th>
                <Th>آزمون</Th>
                <Th>وضعیت</Th>
                <Th>اعتبار اجرا</Th>
                <Th>ایجاد</Th>
                <Th>اتمام</Th>
              </tr>
            </thead>
            <tbody>
              {res.data.map((s) => (
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
                    <SessionStatusBadge status={s.status} />
                  </Td>
                  <Td>
                    <ValidityBadge status={s.validity_status} />
                  </Td>
                  <Td>{faDateTime(s.created_at)}</Td>
                  <Td>{faDateTime(s.completed_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination meta={res.meta} basePath="/sessions" query={{ status, pending }} />
      </Card>
    </>
  );
}
