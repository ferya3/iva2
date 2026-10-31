'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './button';

/** Sign-in details returned once by the API when an account is created or reset. */
export interface AccountCredentials {
  name?: string | null;
  email: string;
  password: string;
  loginUrl: string;
}

/** Ready-to-send message for the new user (SMS, messenger, …). */
export function credentialsMessage(c: AccountCredentials): string {
  return [
    c.name
      ? `${c.name} عزیز، حساب شما در Cognitest آماده است.`
      : 'حساب شما در Cognitest آماده است.',
    `آدرس ورود: ${c.loginUrl}`,
    `نام کاربری (ایمیل): ${c.email}`,
    `رمز موقت: ${c.password}`,
    'لطفاً پس از اولین ورود، از بخش «حساب کاربری» رمز خود را تغییر دهید.',
  ].join('\n');
}

// navigator.clipboard needs a secure context and permission; fall back to a
// selected textarea. It is placed inside the dialog because a modal dialog
// makes the rest of the page inert.
async function copyText(text: string, container: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;inset-inline-start:-9999px;opacity:0';
    (container ?? document.body).appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function CopyButton({
  text,
  label,
  container,
  variant = 'secondary',
  autoFocus,
}: {
  text: string;
  label: string;
  container: () => HTMLElement | null;
  variant?: 'primary' | 'secondary';
  autoFocus?: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (status === 'idle') return;
    const t = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(t);
  }, [status]);
  return (
    <Button
      variant={variant}
      size="sm"
      className="shrink-0"
      data-autofocus={autoFocus ? '' : undefined}
      onClick={async () => setStatus((await copyText(text, container())) ? 'copied' : 'failed')}
    >
      {status === 'copied' ? 'کپی شد ✓' : status === 'failed' ? 'کپی نشد؛ دستی انتخاب کنید' : label}
    </Button>
  );
}

/**
 * Modal that shows a user's sign-in details with copy buttons. It stays open
 * until the operator closes it explicitly, because the password cannot be
 * shown again (a new one can be issued instead).
 */
export function CredentialsDialog({
  credentials,
  title = 'اطلاعات ورود کاربر',
}: {
  credentials: AccountCredentials;
  title?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
  }, [open]);
  if (!open) return null;

  const rows: Array<[string, string]> = [
    ['آدرس ورود', credentials.loginUrl],
    ['نام کاربری (ایمیل)', credentials.email],
    ['رمز موقت', credentials.password],
  ];
  return (
    <dialog
      ref={ref}
      aria-labelledby="credentials-title"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
      dir="rtl"
      data-testid="credentials-dialog"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2 id="credentials-title" className="text-base font-semibold">
            {title}
          </h2>
          {credentials.name ? (
            <p className="mt-1 text-sm text-slate-600">{credentials.name}</p>
          ) : null}
        </div>
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="mb-1 text-xs font-medium text-slate-500">{label}</dt>
              <dd className="flex items-center gap-2">
                <input
                  readOnly
                  value={value}
                  dir="ltr"
                  aria-label={label}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg bg-slate-50 px-3 font-mono text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <CopyButton text={value} label="کپی" container={() => ref.current} />
              </dd>
            </div>
          ))}
        </dl>
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900 ring-1 ring-amber-200 ring-inset">
          این رمز فقط همین یک‌بار نمایش داده می‌شود. اگر گم شد، از دکمهٔ «رمز جدید» در فهرست استفاده
          کنید. کاربر بعد از اولین ورود رمز خود را از «حساب کاربری» تغییر می‌دهد.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <CopyButton
            text={credentialsMessage(credentials)}
            label="کپی متن کامل برای ارسال"
            variant="primary"
            autoFocus
            container={() => ref.current}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              ref.current?.close();
              setOpen(false);
            }}
          >
            ذخیره کردم، بستن
          </Button>
        </div>
      </div>
    </dialog>
  );
}
