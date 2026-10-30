import { cookies } from 'next/headers';
import { API_URL, TENANT_COOKIE, TOKEN_COOKIE } from '@/lib/config';

/** Streams the report PDF from the API, attaching the httpOnly credentials. */
export async function GET(_: Request, { params }: RouteContext<'/api/reports/[id]/download'>) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 });
  const jar = await cookies();
  const upstream = await fetch(`${API_URL}/reports/${id}/download`, {
    headers: {
      Authorization: `Bearer ${jar.get(TOKEN_COOKIE)?.value ?? ''}`,
      'X-Tenant-ID': jar.get(TENANT_COOKIE)?.value ?? '',
      Accept: 'application/pdf',
    },
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body)
    return new Response('Report unavailable', { status: upstream.status });
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition':
        upstream.headers.get('Content-Disposition') ?? 'attachment; filename="report.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
