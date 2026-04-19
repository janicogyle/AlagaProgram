import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

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
    const { data: byId, error: byIdError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, contact_number, role, status, last_login, created_at, updated_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (!byIdError && byId) {
      if (byId.status !== 'Active') {
        return NextResponse.json({ data: null, error: 'Account inactive.' }, { status: 403 });
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
      return NextResponse.json({ data: null, error: 'Admin account not found.' }, { status: 404 });
    }

    const { data: byEmail, error: byEmailError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, contact_number, role, status, last_login, created_at, updated_at')
      .eq('email', email)
      .maybeSingle();

    if (byEmailError || !byEmail) {
      return NextResponse.json({ data: null, error: 'Admin account not found.' }, { status: 404 });
    }

    if (byEmail.status !== 'Active') {
      return NextResponse.json({ data: null, error: 'Account inactive.' }, { status: 403 });
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
        status: byEmail.status || 'Active',
        last_login: new Date().toISOString(),
        created_at: byEmail.created_at || undefined,
        updated_at: new Date().toISOString(),
      };

      const { data: repaired, error: insError } = await supabaseAdmin
        .from('users')
        .insert(insertPayload)
        .select('id, email, full_name, contact_number, role, status, last_login, created_at, updated_at')
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
