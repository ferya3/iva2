'use client';

import { useActionState } from 'react';
import { Alert, Field, Input } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { changePassword } from './actions';

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, { ok: true });
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}
      <Field label="رمز فعلی" htmlFor="current_password" error={state.errors?.current_password}>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field
        label="رمز جدید"
        htmlFor="password"
        hint="دست‌کم ۸ نویسه"
        error={state.errors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <Field
        label="تکرار رمز جدید"
        htmlFor="password_confirmation"
        error={state.errors?.password_confirmation}
      >
        <Input
          id="password_confirmation"
          name="password_confirmation"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>
      <SubmitButton pendingText="در حال ذخیره…">تغییر رمز</SubmitButton>
    </form>
  );
}
