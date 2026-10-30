import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import {
  SESSION_STATUS_META,
  type SessionStatus,
  type ValidityStatus,
} from '@cognitest/shared-types';
import { cn } from '../cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-slate-50 text-slate-700 ring-slate-200',
        info: 'bg-sky-50 text-sky-700 ring-sky-200',
        progress: 'bg-violet-50 text-violet-700 ring-violet-200',
        success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        warning: 'bg-amber-50 text-amber-800 ring-amber-200',
        danger: 'bg-rose-50 text-rose-700 ring-rose-200',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const meta = SESSION_STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.fa}</Badge>;
}

const VALIDITY = {
  valid: { fa: 'معتبر', tone: 'success' },
  questionable: { fa: 'نیازمند بررسی', tone: 'warning' },
  invalid: { fa: 'نامعتبر', tone: 'danger' },
} as const;

export function ValidityBadge({ status }: { status: ValidityStatus | null | undefined }) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge tone={VALIDITY[status].tone}>{VALIDITY[status].fa}</Badge>;
}
