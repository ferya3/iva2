import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Table,
  Td,
  Th,
  faDate,
  faNumber,
} from '@cognitest/ui';
import { api } from '@/lib/api';
import { Pagination } from '@/components/pagination';
import { ActionButton } from '@/components/action-button';
import { TenantForm } from '@/features/tenants/tenant-form';
import { resetOwnerPassword, setTenantStatus } from '@/features/tenants/actions';

export const metadata = { title: 'کلینیک‌ها' };

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'trial' | 'suspended';
  city: string | null;
  members_count: number;
  created_at: string;
  owner: { name: string; email: string } | null;
}
const STATUS = {
  active: { fa: 'فعال', tone: 'success' },
  trial: { fa: 'آزمایشی', tone: 'info' },
  suspended: { fa: 'معلق', tone: 'danger' },
} as const;

export default async function TenantsPage({ searchParams }: PageProps<'/tenants'>) {
  const { q, page } = await searchParams;
  const [tenants, plans] = await Promise.all([
    api<{ data: Tenant[]; meta: { current_page: number; last_page: number; total: number } }>(
      '/admin/tenants',
      {
        query: {
          q: typeof q === 'string' ? q : undefined,
          page: typeof page === 'string' ? page : undefined,
        },
      },
    ),
    api<{ data: Array<{ key: string; name: string }> }>('/admin/plans'),
  ]);
  return (
    <>
      <PageHeader title="کلینیک‌ها" />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <form className="border-b border-slate-100 p-4">
            <Input
              name="q"
              defaultValue={typeof q === 'string' ? q : ''}
              placeholder="جستجوی نام یا شناسه"
            />
          </form>
          <Table>
            <thead>
              <tr>
                <Th>نام</Th>
                <Th>مالک (نام کاربری)</Th>
                <Th>شناسه</Th>
                <Th>وضعیت</Th>
                <Th>اعضا</Th>
                <Th>ایجاد</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {tenants.data.map((t) => (
                <tr key={t.id}>
                  <Td className="font-medium text-slate-900">
                    {t.name}
                    <div className="text-xs text-slate-500">{t.city}</div>
                  </Td>
                  <Td>
                    {t.owner ? (
                      <>
                        <span className="ltr block">{t.owner.email}</span>
                        <span className="text-xs text-slate-500">{t.owner.name}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>
                    <span className="ltr">{t.slug}</span>
                  </Td>
                  <Td>
                    <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].fa}</Badge>
                  </Td>
                  <Td>{faNumber(t.members_count)}</Td>
                  <Td>{faDate(t.created_at)}</Td>
                  <Td className="space-y-2">
                    {t.owner ? (
                      <ActionButton
                        action={resetOwnerPassword.bind(null, t.id)}
                        variant="secondary"
                        size="sm"
                        pendingText="در حال ساخت…"
                        credentialsTitle="اطلاعات ورود مالک کلینیک"
                        confirm={`رمز فعلی ${t.owner.email} باطل و یک رمز موقت جدید ساخته می‌شود. ادامه می‌دهید؟`}
                      >
                        رمز جدید مالک
                      </ActionButton>
                    ) : null}
                    <ActionButton
                      action={setTenantStatus.bind(
                        null,
                        t.id,
                        t.status === 'suspended' ? 'active' : 'suspended',
                      )}
                      variant={t.status === 'suspended' ? 'secondary' : 'ghost'}
                      size="sm"
                      confirm={
                        t.status === 'suspended'
                          ? undefined
                          : 'دسترسی همه کاربران این کلینیک قطع می‌شود. ادامه می‌دهید؟'
                      }
                    >
                      {t.status === 'suspended' ? 'فعال‌سازی' : 'تعلیق'}
                    </ActionButton>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            meta={tenants.meta}
            basePath="/tenants"
            query={{ q: typeof q === 'string' ? q : undefined }}
          />
        </Card>
        <Card>
          <CardHeader title="کلینیک جدید" />
          <CardBody>
            <TenantForm plans={plans.data} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
