import { NextResponse, type NextRequest } from 'next/server';

/**
 * Cheap optimistic gate: no token cookie → login. Real authorisation is
 * enforced by the API on every request.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has('ct_token')) {
    const url = new URL('/login', request.url);
    if (request.nextUrl.pathname !== '/') url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next|favicon.ico|fonts).*)'],
};
