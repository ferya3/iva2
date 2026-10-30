import type { Metadata } from 'next';
import { Alert, Card, CardBody, CardHeader, PageHeader, faDate, faNumber } from '@cognitest/ui';
import { api } from '@/lib/api';
import type { Dashboard } from '@/lib/types';

export const metadata: Metadata = { title: 'اشتراک و پرداخت' };

const PLANS = [
  { name: 'Starter', features: ['یک متخصص', 'ظرفیت محدود آزمون ماهانه'] },
  { name: 'Professional', features: ['چند متخصص', 'گزارش پیشرفته'] },
  { name: 'Clinic', features: ['چند شعبه', 'مدیریت کاربران'] },
  { name: 'Enterprise', features: ['نصب اختصاصی', 'دسترسی API'] },
];

export default async function BillingPage() {
  const d = await api<Dashboard>('/dashboard');
  const sub = d.subscription;
  const used = d.sessions_this_month;
  const limit = sub?.sessions_per_month ?? null;

  return (
    <>
      <PageHeader title="اشتراک و پرداخت" />
      <Card className="mb-6">
        <CardHeader title="اشتراک فعلی" />
        <CardBody>
          {sub ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">پلن</p>
                <p className="text-lg font-semibold">{sub.plan}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">اعتبار تا</p>
                <p className="text-lg font-semibold">{faDate(sub.ends_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">مصرف این ماه</p>
                <p className="text-lg font-semibold">
                  {faNumber(used)} {limit ? `از ${faNumber(limit)}` : '(نامحدود)'} جلسه
                </p>
                {limit ? (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <Alert tone="warning">اشتراک فعالی ندارید.</Alert>
          )}
        </CardBody>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <Card key={p.name} className={p.name === sub?.plan ? 'ring-2 ring-brand-500' : undefined}>
            <CardBody>
              <p className="ltr text-start font-semibold">{p.name}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {p.features.map((f) => <li key={f}>• {f}</li>)}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-500">برای ارتقای پلن یا تمدید با پشتیبانی تماس بگیرید. پرداخت آنلاین از طریق درگاه داخلی در نسخه بعدی فعال می‌شود.</p>
    </>
  );
}
