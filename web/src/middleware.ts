import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/error'
];

const PROTECTED_ROUTE_PREFIXES = ['/dashboard'];

function isPublicRoute(pathname: string): boolean {
  if (pathname === '/' || pathname === '') {
    return true;
  }

  return PUBLIC_ROUTES.some((route) => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((route) => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (isProtectedRoute(pathname)) {
    const sessionCookie = request.cookies.get('guma_sess')?.value;
    
    // TODO: Validate session cookie with backend if necessary
    if (!sessionCookie) {
      return NextResponse.redirect(new URL(`/login`, request.url));
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
