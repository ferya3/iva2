import { Alert, Card, CardBody, CardHeader, PageHeader } from '@cognitest/ui';
import { api } from '@/lib/api';
import { PlanForm, type Plan } from '@/features/plans/plan-form';

export const metadata = { title: 'پلن‌ها' };

export default async function PlansPage() {
  const { data } = await api<{ data: Plan[] }>('/admin/plans');
  return (
    <>
      <PageHeader title="پلن‌های اشتراک" />
      <Alert tone="info" className="mb-6">قیمت نهایی پس از محاسبه هزینه زیرساخت، پشتیبانی و اعتبارسنجی تعیین شود؛ مقدار پیش‌فرض صفر است.</Alert>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.map((p) => (
          <Card key={p.id}>
            <CardHeader title={<span className="ltr">{p.key}</span>} />
            <CardBody><PlanForm plan={p} /></CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
