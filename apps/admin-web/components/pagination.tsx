import Link from 'next/link';
import { faNumber } from '@cognitest/ui';

export function Pagination({
  meta,
  basePath,
  query = {},
}: {
  meta: { current_page: number; last_page: number; total: number };
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  if (meta.last_page <= 1) return null;
  const href = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(query).filter((e): e is [string, string] => !!e[1]),
    );
    params.set('page', String(page));
    return `${basePath}?${params}`;
  };
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
      <span>
        صفحه {faNumber(meta.current_page)} از {faNumber(meta.last_page)} · {faNumber(meta.total)}{' '}
        مورد
      </span>
      <div className="flex gap-2">
        {meta.current_page > 1 ? (
          <Link className="text-brand-700 hover:underline" href={href(meta.current_page - 1)}>
            قبلی
          </Link>
        ) : null}
        {meta.current_page < meta.last_page ? (
          <Link className="text-brand-700 hover:underline" href={href(meta.current_page + 1)}>
            بعدی
          </Link>
        ) : null}
      </div>
    </div>
  );
}
