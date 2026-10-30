import { Card, PageHeader, Table, Td, Th, faDateTime } from '@cognitest/ui';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'گزارش رویدادها' };

interface Log {
  id: number;
  tenant_id: string | null;
  action: string;
  subject_type: string | null;
  subject_id: string | null;
  ip: string | null;
  created_at: string;
  actor: { name: string; email: string } | null;
}

export default async function AuditPage({ searchParams }: PageProps<'/audit'>) {
  const { page, action } = await searchParams;
  const res = await api<{ data: Log[]; current_page: number; last_page: number; total: number }>(
    '/admin/audit-logs',
    {
      query: {
        page: typeof page === 'string' ? page : undefined,
        action: typeof action === 'string' ? action : undefined,
      },
    },
  );
  return (
    <>
      <PageHeader
        title="گزارش رویدادها"
        description="ثبت تغییرناپذیر عملیات حساس (ایجاد، مشاهده و دریافت داده‌ها)."
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>زمان</Th>
              <Th>عملیات</Th>
              <Th>کاربر</Th>
              <Th>موضوع</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {res.data.map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{faDateTime(l.created_at)}</Td>
                <Td>
                  <span className="ltr font-mono text-xs">{l.action}</span>
                </Td>
                <Td>{l.actor?.name ?? 'سیستم'}</Td>
                <Td>
                  <span className="ltr text-xs text-slate-500">
                    {l.subject_type} {l.subject_id?.slice(0, 8)}
                  </span>
                </Td>
                <Td>
                  <span className="ltr text-xs">{l.ip}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination
          meta={res}
          basePath="/audit"
          query={{ action: typeof action === 'string' ? action : undefined }}
        />
      </Card>
    </>
  );
}
