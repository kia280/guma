import { NextRequest, NextResponse } from 'next/server';
import { DEV_SESSION_COOKIE } from '@/lib/dev-auth';
import { DEV_MOCK_COOKIE } from '@/lib/dev-mock';
import { env } from '@/lib/env';

const PUBLIC_ROUTES = ['/login', '/error'];

const PROTECTED_ROUTE_PREFIXES = ['/dashboard'];

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '') {
    return true;
  }

  return PUBLIC_ROUTES.some(route => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(route => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

// Validates the session by forwarding the incoming Cookie header to Kratos
// /sessions/whoami. Returns true only if Kratos confirms an active session.
async function hasValidSession(cookieHeader: string): Promise<boolean> {
  try {
    const res = await fetch(`${env.kratos.internalUrl}/sessions/whoami`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

function redirectToLoginAndClearSession(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/login', request.url));
  // Best-effort client-cookie cleanup. Kratos's own session cookie is
  // httpOnly on its domain, but any same-site alias we've set should go.
  response.cookies.delete('guma_sess');
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (isProtectedRoute(pathname)) {
    if (
      env.devTools &&
      (request.cookies.has(DEV_SESSION_COOKIE) || request.cookies.get(DEV_MOCK_COOKIE)?.value === '1')
    ) {
      return NextResponse.next();
    }
    const cookieHeader = request.headers.get('cookie') ?? '';
    if (!cookieHeader || !(await hasValidSession(cookieHeader))) {
      return redirectToLoginAndClearSession(request);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
