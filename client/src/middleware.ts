import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // If root path, redirect to /en
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/en', request.url));
  }
  
  // Continue with the request
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};