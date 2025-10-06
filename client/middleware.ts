import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only protect app routes, not public routes like login, signup, home, etc.
  if (request.nextUrl.pathname.includes('/app/')) {
    // In a client-side only app with Firebase Auth, we can't reliably check
    // authentication in middleware since the auth state is managed client-side.
    // The real authentication check will be done in the app layout component.
    // This middleware serves as a placeholder for future server-side auth if needed.
    
    // For now, we'll rely on client-side auth guards in the app layout
    // and individual components to redirect unauthenticated users.
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