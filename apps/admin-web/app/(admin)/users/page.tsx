import { Badge, Card, Input, PageHeader, Table, Td, Th, faDateTime, faNumber } from '@cognitest/ui';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';

export const metadata = { title: 'کاربران' };

interface User { id: string; name: string; email: string; platform_role: string | null; is_active: boolean; last_login_at: string | null; memberships_count: number }

export default async function UsersPage({ searchParams }: PageProps<'/users'>) {
  const { q, page } = await searchParams;
  const res = await api<{ data: User[]; current_page: number; last_page: number; total: number }>('/admin/users', { query: { q: typeof q === 'string' ? q : undefined, page: typeof page === 'string' ? page : undefined } });
  return (
    <>
      <PageHeader title="کاربران" />
      <Card>
        <form className="border-b border-slate-100 p-4"><Input name="q" defaultValue={typeof q === 'string' ? q : ''} placeholder="جستجوی نام یا ایمیل" /></form>
        <Table>
          <thead><tr><Th>نام</Th><Th>ایمیل</Th><Th>نقش سامانه</Th><Th>کلینیک‌ها</Th><Th>آخرین ورود</Th></tr></thead>
          <tbody>
            {res.data.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium text-slate-900">{u.name} {u.is_active ? null : <Badge tone="danger">غیرفعال</Badge>}</Td>
                <Td><span className="ltr">{u.email}</span></Td>
                <Td>{u.platform_role === 'super_admin' ? <Badge tone="progress">مدیر سامانه</Badge> : '—'}</Td>
                <Td>{faNumber(u.memberships_count)}</Td>
                <Td>{faDateTime(u.last_login_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pagination meta={res} basePath="/users" query={{ q: typeof q === 'string' ? q : undefined }} />
      </Card>
    </>
  );
}
