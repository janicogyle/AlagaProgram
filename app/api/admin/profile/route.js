import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { normalizeSectorAccess } from '@/lib/sectorAccess';

export const runtime = 'nodejs';

const USER_PROFILE_FIELDS = 'id, email, full_name, contact_number, role, status, last_login, created_at, updated_at, sector_access';
const USER_PROFILE_FALLBACK_FIELDS = 'id, email, full_name, contact_number, role, status, last_login, created_at, updated_at';
const ALLOWED_PORTAL_ROLES = new Set(['Admin', 'Staff']);

async function selectUserProfile(column, value) {
  let { data, error } = await supabaseAdmin
    .from('users')
    .select(USER_PROFILE_FIELDS)
    .eq(column, value)
    .maybeSingle();

  if (error && String(error.message || '').includes('sector_access')) {
    ;({ data, error } = await supabaseAdmin
      .from('users')
      .select(USER_PROFILE_FALLBACK_FIELDS)
      .eq(column, value)
      .maybeSingle());
  }

  if (data) data.sector_access = data.role === 'Admin' ? [] : normalizeSectorAccess(data.sector_access);
  return { data, error };
}

function validatePortalProfile(profile) {
  if (!ALLOWED_PORTAL_ROLES.has(profile?.role)) {
    return { ok: false, error: 'Account is not authorized for the staff/admin portal.', status: 403 };
  }

  if (profile.status !== 'Active') {
    return { ok: false, error: 'Account inactive.', status: 403 };
  }

  if (profile.role === 'Staff' && normalizeSectorAccess(profile.sector_access).length === 0) {
    return {
      ok: false,
      error: 'Staff account has no assigned sectors. Please contact an administrator.',
      status: 403,
    };
  }

  return { ok: true };
}

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Server configuration error. Missing SUPABASE_SERVICE_ROLE_KEY (Supabase admin client not available).',
        },
        { status: 500 },
      );
    }

    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    const authUser = userData?.user;

    if (userError || !authUser) {
      return NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 });
    }

    // 1) Prefer lookup by auth UID (expected schema)
    const { data: byId, error: byIdError } = await selectUserProfile('id', authUser.id);

    if (!byIdError && byId) {
      const validation = validatePortalProfile(byId);
      if (!validation.ok) {
        return NextResponse.json({ data: null, error: validation.error }, { status: validation.status });
      }

      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authUser.id);

      return NextResponse.json({ data: byId, error: null });
    }

    // 2) Back-compat: if users table was created with random IDs, try lookup by email and repair
    const email = authUser.email;
    if (!email) {
      return NextResponse.json({ data: null, error: 'Account profile not found.' }, { status: 404 });
    }

    const { data: byEmail, error: byEmailError } = await selectUserProfile('email', email);

    if (byEmailError || !byEmail) {
      return NextResponse.json({ data: null, error: 'Account profile not found.' }, { status: 404 });
    }

    const emailValidation = validatePortalProfile(byEmail);
    if (!emailValidation.ok) {
      return NextResponse.json({ data: null, error: emailValidation.error }, { status: emailValidation.status });
    }

    // If IDs mismatch, repair by re-inserting with correct auth UID.
    if (String(byEmail.id) !== String(authUser.id)) {
      // Delete the old row (email is unique, so we must free it first)
      const { error: delError } = await supabaseAdmin.from('users').delete().eq('email', email);
      if (delError) throw delError;

      const insertPayload = {
        id: authUser.id,
        full_name: byEmail.full_name || 'User',
        email: byEmail.email,
        contact_number: byEmail.contact_number || null,
        role: byEmail.role || 'Staff',
        sector_access: byEmail.role === 'Admin' ? [] : normalizeSectorAccess(byEmail.sector_access),
        status: byEmail.status || 'Active',
        last_login: new Date().toISOString(),
        created_at: byEmail.created_at || undefined,
        updated_at: new Date().toISOString(),
      };

      const { data: repaired, error: insError } = await supabaseAdmin
        .from('users')
        .insert(insertPayload)
        .select(USER_PROFILE_FIELDS)
        .single();

      if (insError) throw insError;

      return NextResponse.json({ data: repaired, error: null, repaired: true });
    }

    // IDs already match (rare if the first query errored); still update last_login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', byEmail.id);

    return NextResponse.json({ data: byEmail, error: null });
  } catch (error) {
    console.error('Admin profile resolve error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to resolve admin profile.' },
      { status: 500 },
    );
  }
}
