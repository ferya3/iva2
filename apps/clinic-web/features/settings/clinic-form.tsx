'use client';

import { useActionState } from 'react';
import { Alert, Field, Input } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { updateClinic } from './actions';

export interface Clinic {
  name: string;
  slug: string;
  city: string | null;
  phone: string | null;
  license_number: string | null;
}

export function ClinicForm({ clinic, editable }: { clinic: Clinic; editable: boolean }) {
  const [state, action] = useActionState(updateClinic, { ok: true });
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {state.message ? <Alert className="sm:col-span-2" tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}
      <Field label="نام کلینیک" htmlFor="name" error={state.errors?.name}>
        <Input id="name" name="name" defaultValue={clinic.name} disabled={!editable} required />
      </Field>
      <Field label="شناسه" htmlFor="slug">
        <Input id="slug" defaultValue={clinic.slug} dir="ltr" disabled />
      </Field>
      <Field label="شهر" htmlFor="city">
        <Input id="city" name="city" defaultValue={clinic.city ?? ''} disabled={!editable} />
      </Field>
      <Field label="تلفن" htmlFor="phone">
        <Input id="phone" name="phone" dir="ltr" defaultValue={clinic.phone ?? ''} disabled={!editable} />
      </Field>
      <Field label="شماره پروانه" htmlFor="license_number">
        <Input id="license_number" name="license_number" dir="ltr" defaultValue={clinic.license_number ?? ''} disabled={!editable} />
      </Field>
      {editable ? (
        <div className="flex items-end justify-end sm:col-span-2">
          <SubmitButton pendingText="در حال ذخیره…">ذخیره</SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
