'use client';

import { useActionState } from 'react';
import { Alert, CredentialsDialog, Field, Input, Select } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { addMember } from './actions';

export function MemberForm() {
  const [state, action] = useActionState(addMember, { ok: true });
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}
      {state.credentials ? (
        <CredentialsDialog key={state.credentials.password} credentials={state.credentials} />
      ) : null}
      <Field label="ایمیل" htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          defaultValue={state.values?.email}
          type="email"
          dir="ltr"
          required
        />
      </Field>
      <Field label="نام (برای حساب جدید)" htmlFor="name" error={state.errors?.name}>
        <Input id="name" name="name" defaultValue={state.values?.name} />
      </Field>
      <Field label="نقش" htmlFor="role" error={state.errors?.role}>
        <Select
          key={state.values?.role}
          id="role"
          name="role"
          defaultValue={state.values?.role ?? 'clinician'}
        >
          <option value="clinician">متخصص</option>
          <option value="assistant">دستیار</option>
          <option value="admin">مدیر کلینیک</option>
        </Select>
      </Field>
      <SubmitButton pendingText="در حال افزودن…">افزودن به تیم</SubmitButton>
    </form>
  );
}
