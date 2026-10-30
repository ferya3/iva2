import type { ReactNode } from 'react';
import { cn } from '@cognitest/ui';

const STEPS = ['ورود', 'بررسی تجهیزات', 'کالیبراسیون', 'آزمون', 'ارسال داده'];

export function Shell({
  step,
  title,
  children,
  footer,
}: {
  step: number;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-slate-50 to-brand-50/40">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white/70 px-8 py-4 backdrop-blur">
        <span className="ltr font-bold text-slate-900">Cognitest</span>
        <ol className="flex gap-2 text-xs">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={cn(
                'rounded-full px-3 py-1',
                i === step
                  ? 'bg-brand-600 text-white'
                  : i < step
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-slate-100 text-slate-400',
              )}
            >
              {label}
            </li>
          ))}
        </ol>
      </header>
      <main className="flex flex-1 items-center justify-center overflow-y-auto p-8">
        <section className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
          {children}
          {footer ? <div className="mt-8 flex justify-end gap-3">{footer}</div> : null}
        </section>
      </main>
    </div>
  );
}
