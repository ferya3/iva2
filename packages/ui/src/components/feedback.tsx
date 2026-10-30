import type { ReactNode } from 'react';
import { cn } from '../cn';

const tones = {
  info: 'bg-sky-50 text-sky-800 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof tones;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-lg px-4 py-3 text-sm ring-1 ring-inset', tones[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : undefined}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-card bg-white p-5 ring-1 ring-slate-200/80">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {icon ? <span className="text-brand-600">{icon}</span> : null}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-e-transparent',
        className,
      )}
    />
  );
}
