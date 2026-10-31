import 'server-only';
import type { AccountCredentials } from '@cognitest/ui';
import { cookies, headers as requestHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ApiError } from '@cognitest/shared-types';
import { API_URL, TENANT_COOKIE, TOKEN_COOKIE } from './config';

/**
 * Backend-for-frontend client. The Sanctum token lives in an httpOnly
 * cookie and is only ever attached here, on the server — browser
 * JavaScript never sees it.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError & { details?: Record<string, unknown> },
  ) {
    super(body.message);
  }

  get code(): string | undefined {
    return this.body.code;
  }

  get fieldErrors(): Record<string, string[]> {
    return this.body.errors ?? {};
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip the X-Tenant-ID header (account-level endpoints). */
  tenantless?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  const tenant = jar.get(TENANT_COOKIE)?.value;

  const url = new URL(API_URL + path);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Accept-Language', 'fa');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (tenant && !options.tenantless) headers.set('X-Tenant-ID', tenant);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const forwardedFor = await clientForwardedFor();
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: 'no-store',
  });

  if (res.status === 401) redirect('/login?expired=1');
  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({ message: res.statusText }));
  if (!res.ok) {
    if (res.status === 403 && body?.code === 'tenant_forbidden') redirect('/select-clinic');
    throw new ApiRequestError(res.status, body);
  }
  return body as T;
}

/**
 * The API only sees this Next.js server; pass the browser's address along
 * (the API trusts X-Forwarded-For from the private network only) so login
 * throttling and audit logs work per client, not per panel instance.
 */
export async function clientForwardedFor(): Promise<string | null> {
  const h = await requestHeaders();
  return h.get('x-forwarded-for') ?? h.get('x-real-ip');
}

/** Converts an API failure into a form state for useActionState. */
export function toFormError(error: unknown): FormState {
  if (error instanceof ApiRequestError) {
    return { ok: false, message: persianMessage(error), errors: error.fieldErrors };
  }
  throw error;
}

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

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'ایمیل یا رمز عبور اشتباه است.',
  too_many_attempts: 'تعداد تلاش‌ها زیاد است؛ چند دقیقه دیگر دوباره امتحان کنید.',
  quota_exceeded: 'سقف مجاز پلن اشتراک شما تکمیل شده است.',
  subscription_required: 'اشتراک فعالی برای این کلینیک وجود ندارد.',
  permission_denied: 'شما مجوز انجام این عملیات را ندارید.',
  invalid_session_transition: 'این عملیات در وضعیت فعلی جلسه امکان‌پذیر نیست.',
  session_not_reportable: 'گزارش فقط برای جلسات تحلیل‌شده و معتبر قابل صدور است.',
  already_member: 'این کاربر قبلاً عضو کلینیک است.',
  assessment_unavailable: 'این نسخه آزمون در دسترس نیست.',
};

export function persianMessage(error: ApiRequestError): string {
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!;
  if (error.status === 422) return 'اطلاعات وارد شده را بررسی کنید.';
  return 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';
}
