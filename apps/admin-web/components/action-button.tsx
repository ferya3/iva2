'use client';

import { useActionState } from 'react';
import { Alert, CredentialsDialog, type ButtonProps } from '@cognitest/ui';
import type { FormState } from '@/lib/api';
import { SubmitButton } from './submit-button';

/** A one-button form bound to a server action, with inline feedback. */
export function ActionButton({
  action,
  children,
  confirm,
  credentialsTitle,
  ...props
}: ButtonProps & {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  confirm?: string;
  /** Title of the dialog that shows sign-in details returned by the action. */
  credentialsTitle?: string;
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
        <CredentialsDialog
          key={state.credentials.password}
          credentials={state.credentials}
          title={credentialsTitle}
        />
      ) : null}
    </form>
  );
}
