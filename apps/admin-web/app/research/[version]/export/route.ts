import { cookies } from 'next/headers';
import { API_URL, TOKEN_COOKIE } from '@/lib/config';

/** Streams the anonymised research CSV from the API, attaching the httpOnly token. */
export async function GET(_: Request, { params }: RouteContext<'/research/[version]/export'>) {
  const { version } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(version)) return new Response('Not found', { status: 404 });
  const token = (await cookies()).get(TOKEN_COOKIE)?.value ?? '';
  const upstream = await fetch(`${API_URL}/admin/assessment-versions/${version}/research-export`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body)
    return new Response('Export unavailable', { status: upstream.status });
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition':
        upstream.headers.get('Content-Disposition') ?? 'attachment; filename="research.csv"',
      'Cache-Control': 'private, no-store',
    },
  });
}
