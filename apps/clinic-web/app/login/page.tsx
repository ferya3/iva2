import type { Metadata } from 'next';
import { Card, CardBody } from '@cognitest/ui';
import { Logo } from '@/components/logo';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = { title: 'ورود' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-brand-50 to-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="text-xl" />
          <p className="mt-2 text-sm text-slate-500">پنل ارزیابی شناختی کلینیک</p>
        </div>
        <Card>
          <CardBody className="p-6">
            <LoginForm next={typeof params.next === 'string' ? params.next : undefined} expired={params.expired === '1'} />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
