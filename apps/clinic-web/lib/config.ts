import 'server-only';

export const API_URL = process.env.COGNITEST_API_URL ?? 'http://localhost:8000/api/v1';
export const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export const TOKEN_COOKIE = 'ct_token';
export const TENANT_COOKIE = 'ct_tenant';
