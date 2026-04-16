import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function requireAdmin(request) {
  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          data: null,
          error:
            'Server configuration error. Missing SUPABASE_SERVICE_ROLE_KEY (Supabase admin client not available).',
        },
        { status: 500 },
      ),
    };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 }),
    };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const authUser = userData?.user;

  if (userError || !authUser) {
    return {
      ok: false,
      response: NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, role, status')
    .eq('id', authUser.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 }),
    };
  }

  if (profile.status !== 'Active') {
    return {
      ok: false,
      response: NextResponse.json({ data: null, error: 'Account inactive.' }, { status: 403 }),
    };
  }

  if (profile.role !== 'Admin') {
    return {
      ok: false,
      response: NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 }),
    };
  }

  return { ok: true, authUser, profile };
}
