'use client';

import { useActionState } from 'react';
import { Alert, Field, Input } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { updateEligibility } from './actions';

export function AgeRangeForm({
  versionId,
  min,
  max,
  audience,
}: {
  versionId: string;
  min: number | null;
  max: number | null;
  audience: string | null;
}) {
  const [state, action] = useActionState(updateEligibility.bind(null, versionId), { ok: true });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-brand-700">ویرایش گروه سنی</summary>
      <form action={action} className="mt-3 w-64 space-y-3">
        {state.message ? (
          <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Field label="از سن" htmlFor={`min-${versionId}`} error={state.errors?.min_age_years}>
            <Input
              id={`min-${versionId}`}
              name="min_age_years"
              type="number"
              min={0}
              max={120}
              dir="ltr"
              defaultValue={min ?? ''}
            />
          </Field>
          <Field label="تا سن" htmlFor={`max-${versionId}`} error={state.errors?.max_age_years}>
            <Input
              id={`max-${versionId}`}
              name="max_age_years"
              type="number"
              min={0}
              max={120}
              dir="ltr"
              defaultValue={max ?? ''}
            />
          </Field>
        </div>
        <Field
          label="عنوان گروه"
          htmlFor={`aud-${versionId}`}
          hint="مثلاً «کودکان ۶ تا ۸ سال». خالی = بدون محدودیت."
        >
          <Input id={`aud-${versionId}`} name="audience_label" defaultValue={audience ?? ''} />
        </Field>
        <SubmitButton size="sm" pendingText="در حال ذخیره…">
          ذخیره
        </SubmitButton>
      </form>
    </details>
  );
}
