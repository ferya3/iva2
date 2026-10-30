import { Card, CardBody } from '@cognitest/ui';
import { Logo } from '@/components/logo';
import { LoginForm } from '@/features/auth/login-form';

export const metadata = { title: 'ورود مدیر' };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-900 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <Logo className="text-xl !text-white" />
          <p className="mt-2 text-sm text-slate-400">مدیریت کل سامانه</p>
        </div>
        <Card>
          <CardBody className="p-6">
            <LoginForm />
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
