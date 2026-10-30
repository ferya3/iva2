'use client';

import { useFormStatus } from 'react-dom';
import { Button, Spinner, type ButtonProps } from '@cognitest/ui';

export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <Spinner /> : null}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
