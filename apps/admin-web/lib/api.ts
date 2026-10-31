import 'server-only';
import type { AccountCredentials } from '@cognitest/ui';
import { cookies, headers as requestHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_URL, TOKEN_COOKIE } from './config';

export interface FormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  /** Submitted values, so a form that failed keeps what the user typed. */
  values?: Record<string, string>;
  /** One-time sign-in details of an account that was just created or reset. */
  credentials?: AccountCredentials;
}

/** Text fields of a submitted form (never passwords), to refill it after an error. */
export function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === 'string' && !key.startsWith('$') && !key.includes('password'))
      values[key] = value;
  });
  return values;
}

/** Sign-in details as the API returns them (`credentials`). */
export interface ApiCredentials {
  name: string | null;
  email: string;
  password: string;
  login_url: string;
}

export function toCredentials(
  c: ApiCredentials | null | undefined,
): AccountCredentials | undefined {
  return c
    ? { name: c.name, email: c.email, password: c.password, loginUrl: c.login_url }
    : undefined;
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
  const forwardedFor = await clientForwardedFor();
  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(init.query ?? {}))
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
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

/** Browser address for the API's rate limits and audit log (see clinic-web). */
export async function clientForwardedFor(): Promise<string | null> {
  const h = await requestHeaders();
  return h.get('x-forwarded-for') ?? h.get('x-real-ip');
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
