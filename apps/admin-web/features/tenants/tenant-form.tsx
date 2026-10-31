'use client';

import { useActionState } from 'react';
import { Alert, CredentialsDialog, Field, Input, Select } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { createTenant } from './actions';

export function TenantForm({ plans }: { plans: Array<{ key: string; name: string }> }) {
  const [state, action] = useActionState(createTenant, { ok: true });
  return (
    <form action={action} className="space-y-4">
      {state.message ? <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}
      {state.credentials ? (
        <CredentialsDialog
          key={state.credentials.password}
          credentials={state.credentials}
          title="اطلاعات ورود مالک کلینیک"
        />
      ) : null}
      <Field label="نام کلینیک" htmlFor="name" error={state.errors?.name}>
        <Input id="name" name="name" defaultValue={state.values?.name} required />
      </Field>
      <Field label="شهر" htmlFor="city">
        <Input id="city" name="city" defaultValue={state.values?.city} />
      </Field>
      <Field label="نام مالک" htmlFor="owner_name" error={state.errors?.owner_name}>
        <Input id="owner_name" name="owner_name" defaultValue={state.values?.owner_name} required />
      </Field>
      <Field label="ایمیل مالک" htmlFor="owner_email" error={state.errors?.owner_email}>
        <Input
          id="owner_email"
          name="owner_email"
          defaultValue={state.values?.owner_email}
          type="email"
          dir="ltr"
          required
        />
      </Field>
      <Field label="پلن" htmlFor="plan">
        <Select
          key={state.values?.plan}
          id="plan"
          name="plan"
          defaultValue={state.values?.plan ?? 'starter'}
        >
          {plans.map((p) => (
            <option key={p.key} value={p.key}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton pendingText="در حال ایجاد…">ایجاد کلینیک</SubmitButton>
    </form>
  );
}
