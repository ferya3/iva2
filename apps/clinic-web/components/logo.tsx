export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold text-slate-900 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-brand-600" />
        <circle cx="16" cy="16" r="7" fill="none" stroke="white" strokeWidth="2.5" />
        <circle cx="16" cy="16" r="2.5" fill="white" />
      </svg>
      <span className="ltr">Cognitest</span>
    </span>
  );
}
