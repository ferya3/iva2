import type { Metadata } from 'next';
import { Card, CardBody, CardHeader, PageHeader } from '@cognitest/ui';
import { currentUser } from '@/lib/auth';
import { PasswordForm } from '@/features/account/password-form';

export const metadata: Metadata = { title: 'حساب کاربری' };

export default async function AccountPage() {
  const { user } = await currentUser();
  return (
    <>
      <PageHeader
        title="حساب کاربری"
        description="اگر با رمز موقت وارد شده‌اید، همین‌جا رمز خود را عوض کنید."
      />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <CardBody>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">نام</dt>
                <dd className="mt-1 font-medium text-slate-900">{user.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">نام کاربری (ایمیل)</dt>
                <dd className="ltr mt-1 font-medium text-slate-900">{user.email}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="تغییر رمز عبور" />
          <CardBody>
            <PasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
