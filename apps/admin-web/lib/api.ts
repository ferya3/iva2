import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, TOKEN_COOKIE } from './config';

export interface FormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: { message: string; code?: string; errors?: Record<string, string[]> },
  ) {
    super(body.message);
  }
}

/** Server-side client for the platform admin API (/admin/*). */
export async function api<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {},
): Promise<T> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(init.query ?? {}))
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 403) redirect('/login?expired=1');
  const body = await res.json().catch(() => ({ message: res.statusText }));
  if (!res.ok) throw new ApiRequestError(res.status, body);
  return body as T;
}

export function toFormError(e: unknown): FormState {
  if (e instanceof ApiRequestError) {
    return {
      ok: false,
      message: e.status === 422 ? 'اطلاعات وارد شده را بررسی کنید.' : e.body.message,
      errors: e.body.errors,
    };
  }
  throw e;
}
