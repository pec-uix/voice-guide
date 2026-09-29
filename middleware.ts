import { auth } from './auth';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;

  // Already logged in → skip the login page
  if (path === '/admin' && isLoggedIn) {
    return Response.redirect(new URL('/admin/exhibitions', req.url));
  }

  // Protected sub-pages → go to login if not authenticated
  if (path !== '/admin' && path.startsWith('/admin') && !isLoggedIn) {
    return Response.redirect(new URL('/admin', req.url));
  }
});

export const config = {
  matcher: ['/admin/:path*', '/admin'],
};
