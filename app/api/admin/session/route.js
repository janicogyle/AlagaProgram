import { NextResponse } from 'next/server';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  readAdminSessionToken,
} from '@/lib/adminSession.server';
import { logActivity, logStaffActivity } from '@/lib/activityLogger.server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function clearAdminSessionCookie(res) {
  res.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

async function createPortalSessionResponse(request, { logLogin = false } = {}) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;

  let sessionToken;
  try {
    sessionToken = createAdminSessionToken(auth.profile);
  } catch (error) {
    return NextResponse.json(
      { data: null, error: error?.message || 'Unable to create admin session.' },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    data: {
      id: auth.profile.id,
      full_name: auth.profile.full_name,
      email: auth.profile.email,
      role: auth.profile.role,
      status: auth.profile.status,
      sector_access: auth.profile.sector_access || [],
    },
    error: null,
  });

  res.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });

  if (logLogin) {
    await logStaffActivity(
      auth,
      {
        action: 'Logged in',
        message: 'Signed in to the Alaga staff portal.',
        entity_type: 'user_session',
        entity_id: auth.profile.id,
        reference_number: auth.profile.email || auth.profile.id,
        link: '/admin/activity-logs',
      },
      supabaseAdmin,
    );
  }

  return res;
}

export async function POST(request) {
  return createPortalSessionResponse(request, { logLogin: true });
}

// Refresh the signed cookie from the currently verified Supabase identity.
export async function PUT(request) {
  return createPortalSessionResponse(request);
}

export async function DELETE(request) {
  const authorization = request.headers.get('authorization');
  const auth = authorization ? await requireStaffOrAdmin(request) : null;
  const cookieSession = readAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  const actor = auth?.ok
    ? {
        id: auth.profile.id,
        name: auth.profile.full_name,
        role: auth.profile.role,
        email: auth.profile.email,
      }
    : cookieSession.ok
      ? cookieSession.user
      : null;

  const logoutActivity = {
    action: 'Logged out',
    message: 'Signed out of the Alaga staff portal.',
    entity_type: 'user_session',
    entity_id: actor?.id || null,
    reference_number: actor?.email || actor?.id || null,
    link: '/admin/activity-logs',
  };

  if (auth?.ok) {
    await logStaffActivity(auth, logoutActivity, supabaseAdmin);
  } else if (actor) {
    await logActivity(
      {
        actor_user_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        ...logoutActivity,
      },
      supabaseAdmin,
    );
  }

  const res = NextResponse.json({ success: true });
  clearAdminSessionCookie(res);
  return res;
}
