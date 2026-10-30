'use client';

import { useActionState } from 'react';
import { Alert, Field, Input } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { login } from './actions';

export function LoginForm() {
  const [state, action] = useActionState(login, { ok: true });
  return (
    <form action={action} className="space-y-4">
      {!state.ok ? <Alert tone="danger">{state.message}</Alert> : null}
      <Field label="ایمیل" htmlFor="email">
        <Input id="email" name="email" type="email" dir="ltr" autoComplete="username" required />
      </Field>
      <Field label="رمز عبور" htmlFor="password">
        <Input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="در حال ورود…">ورود</SubmitButton>
    </form>
  );
}
