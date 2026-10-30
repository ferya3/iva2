'use client';

import { useActionState, useState } from 'react';
import { Copy, KeyRound, MonitorPlay } from 'lucide-react';
import { Alert, Button, faDateTime } from '@cognitest/ui';
import { SubmitButton } from '@/components/submit-button';
import { createInvite, type InviteState } from './actions';

/**
 * The invite code is shown exactly once (only its hash is stored). The
 * participant types it into the desktop player or opens the deep link.
 */
export function InvitePanel({ sessionId, canReissue, autoIssue }: { sessionId: string; canReissue: boolean; autoIssue: boolean }) {
  const [state, action] = useActionState<InviteState>(createInvite.bind(null, sessionId), { ok: true });
  const [copied, setCopied] = useState(false);

  if (state.invite) {
    const { code, deep_link, expires_at } = state.invite;
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-brand-50 p-5 text-center ring-1 ring-brand-100">
          <p className="text-sm text-brand-900">کد ورود به برنامه آزمون</p>
          <p className="ltr mt-2 font-mono text-4xl font-bold tracking-[0.2em] text-brand-700">{code}</p>
          <p className="mt-2 text-xs text-slate-500">معتبر تا {faDateTime(expires_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            }}
          >
            <Copy className="h-4 w-4" /> {copied ? 'کپی شد' : 'کپی کد'}
          </Button>
          <a href={deep_link} className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm text-brand-700 hover:bg-brand-50">
            <MonitorPlay className="h-4 w-4" /> باز کردن در برنامه آزمون همین رایانه
          </a>
        </div>
        <Alert tone="info">این کد فقط یک‌بار نمایش داده می‌شود. در صورت نیاز می‌توانید کد جدید صادر کنید؛ کد قبلی باطل می‌شود.</Alert>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {!state.ok && state.message ? <Alert tone="danger">{state.message}</Alert> : null}
      <p className="text-sm text-slate-600">
        برای اجرای آزمون، برنامه دسکتاپ Cognitest را روی رایانه آزمون باز کنید و کد ورود را وارد کنید.
      </p>
      <SubmitButton disabled={!canReissue} autoFocus={autoIssue} pendingText="در حال صدور…">
        <KeyRound className="h-4 w-4" /> صدور کد ورود
      </SubmitButton>
    </form>
  );
}
