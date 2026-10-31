import type { Metadata } from 'next';
import { Card, CardBody, CardHeader, PageHeader } from '@cognitest/ui';
import { PasswordForm } from '@/features/account/password-form';

export const metadata: Metadata = { title: 'حساب کاربری' };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="حساب کاربری" />
      <Card className="max-w-xl">
        <CardHeader title="تغییر رمز عبور" />
        <CardBody>
          <PasswordForm />
        </CardBody>
      </Card>
    </>
  );
}
