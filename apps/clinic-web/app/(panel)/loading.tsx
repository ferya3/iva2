import { Spinner } from '@cognitest/ui';

export default function Loading() {
  return (
    <div className="flex items-center gap-2 py-16 text-slate-500">
      <Spinner /> در حال بارگذاری…
    </div>
  );
}
