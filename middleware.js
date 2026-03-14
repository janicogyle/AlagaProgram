import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const AUTH_REQUIRED_PREFIXES = ['/dashboard'];

const MODULE_ALIAS_REDIRECTS = {
  '/dashboard': '/dashboard',
  '/analytics': '/dashboard/analytics',
  '/registration': '/dashboard/registration',
  '/assistance': '/dashboard/assistance',
  '/assistance-tracking': '/dashboard/assistance',
  '/alaga-list': '/dashboard/residents',
  '/residents': '/dashboard/residents',
  '/reports': '/dashboard/reports',
  '/users': '/dashboard/users',
};

const ROLE_RULES = [
  {
    prefix: '/dashboard/users',
    allowedRoles: ['admin', 'super_admin'],
  },
  {
    prefix: '/dashboard/reports',
    allowedRoles: ['admin', 'super_admin', 'staff'],
  },
  {
    prefix: '/dashboard/analytics',
    allowedRoles: ['admin', 'super_admin', 'staff'],
  },
];

function copyCookies(fromResponse, toResponse) {
  fromResponse.cookies.getAll().forEach((cookie) => {
    toResponse.cookies.set(cookie);
  });
}

function getRoleFromUser(user) {
  const role = user?.app_metadata?.role || user?.user_metadata?.role || null;
  return role ? String(role).toLowerCase() : null;
}

function getCanonicalModulePath(pathname) {
  const lowerPath = pathname.toLowerCase();
  return MODULE_ALIAS_REDIRECTS[lowerPath] || null;
}

function isRoleAllowed(pathname, role) {
  const rule = ROLE_RULES.find((item) => pathname.startsWith(item.prefix));

  // If there is no explicit rule or no assigned role, allow authenticated access.
  if (!rule || !role) {
    return true;
  }

  return rule.allowedRoles.includes(role);
}

function redirectTo(request, fromResponse, pathname, withNext = false) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = pathname;

  if (withNext) {
    redirectUrl.searchParams.set('next', request.nextUrl.pathname);
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);
  copyCookies(fromResponse, redirectResponse);
  return redirectResponse;
}

export async function middleware(request) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;
  const canonicalModulePath = getCanonicalModulePath(pathname);

  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const requiresModuleAuth = Boolean(canonicalModulePath);

  if (requiresModuleAuth && !user) {
    return redirectTo(request, response, '/login', true);
  }

  if (requiresModuleAuth && user && canonicalModulePath !== pathname) {
    return redirectTo(request, response, canonicalModulePath);
  }

  if (requiresAuth && !user) {
    return redirectTo(request, response, '/login', true);
  }

  if (requiresAuth && user) {
    const role = getRoleFromUser(user);
    if (!isRoleAllowed(pathname, role)) {
      return redirectTo(request, response, '/dashboard');
    }
  }

  if (pathname === '/login' && user) {
    return redirectTo(request, response, '/dashboard');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)'],
};
