import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Create next-intl middleware
const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'fr', 'es'],
  defaultLocale: 'en'
});

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // If root path, redirect to /en
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/en', request.url));
  }
  
  // Handle internationalization for localized routes
  if (pathname.match(/^\/(en|fr|es)(\/.*)?$/)) {
    return intlMiddleware(request);
  }
  
  // Continue with the request for non-localized routes
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};