'use client';

import { useActionState } from 'react';
import { Alert, Field, Input } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { login } from './actions';

export function LoginForm({ next, expired }: { next?: string; expired?: boolean }) {
  const [state, action] = useActionState(login, { ok: true });
  return (
    <form action={action} className="space-y-4">
      {expired && state.ok ? <Alert tone="warning">نشست شما منقضی شده است؛ دوباره وارد شوید.</Alert> : null}
      {!state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <input type="hidden" name="next" value={next ?? '/'} />
      <Field label="ایمیل" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" dir="ltr" required />
      </Field>
      <Field label="رمز عبور" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" dir="ltr" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="در حال ورود…">
        ورود به پنل
      </SubmitButton>
    </form>
  );
}
