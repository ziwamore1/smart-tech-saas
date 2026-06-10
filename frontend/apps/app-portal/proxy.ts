import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INSTITUTION_TYPES = ['PRIMARY_SCHOOL', 'SECONDARY_SCHOOL', 'ADVANCED_SECONDARY', 'COLLEGE', 'UNIVERSITY'];

const LANDING_URL = 'https://www.smarttechsaas.com';

const PUBLIC_PATHS = ['/login', '/register', '/super-admin-register', '/forgot-password', '/reset-password', '/verify', '/public-timetable', '/landing', '/api'];

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

function getInstitutionTypeFromToken(request: NextRequest): string | null {
  const authCookie = request.cookies.get('auth_token')?.value;
  if (!authCookie) return null;
  try {
    const payload = JSON.parse(atob(authCookie.split('.')[1]));
    return payload.institutionType || null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;
  const isAuthenticated = !!token;
  const isPublic = isPublicPath(pathname);

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL(LANDING_URL));
  }

  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/api')) {
    const institutionType = getInstitutionTypeFromToken(request);
    const response = NextResponse.next();
    if (institutionType) {
      response.headers.set('x-institution-type', institutionType);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|images/|fonts/|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js)$).*)',
  ],
};
