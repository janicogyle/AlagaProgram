import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

function getBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function requireRoles(request, allowedRoles) {
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
    .select('id, role, status, full_name, email')
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

  if (!allowedRoles.includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 }),
    };
  }

  return { ok: true, authUser, profile };
}

export async function requireAdmin(request) {
  return requireRoles(request, ['Admin']);
}

export async function requireStaffOrAdmin(request) {
  return requireRoles(request, ['Admin', 'Staff']);
}

export async function verifyUserPassword(email, password) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, error: 'Server configuration error. Supabase anon key is missing.' };
  }

  if (!email || !password) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    return { ok: false, error: 'Invalid password.' };
  }

  await client.auth.signOut();
  return { ok: true, error: null };
}
