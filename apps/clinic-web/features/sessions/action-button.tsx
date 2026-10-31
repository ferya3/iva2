'use client';

import { useActionState } from 'react';
import { Alert, CredentialsDialog, type ButtonProps } from '@cognitest/ui';
import type { FormState } from '@/lib/api';
import { SubmitButton } from '@/components/submit-button';

/** A one-button form bound to a server action, with inline feedback. */
export function ActionButton({
  action,
  children,
  confirm,
  ...props
}: ButtonProps & {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  confirm?: string;
  pendingText?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: true });
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="space-y-2"
    >
      <SubmitButton {...props}>{children}</SubmitButton>
      {state.message ? <Alert tone={state.ok ? 'success' : 'danger'}>{state.message}</Alert> : null}
      {state.credentials ? (
        <CredentialsDialog key={state.credentials.password} credentials={state.credentials} />
      ) : null}
    </form>
  );
}
