import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, contact_number, role, status, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch users.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const { email, password, fullName, contactNumber, role } = body;

    // Validate input
    if (!email || !password || !fullName || !role) {
      return NextResponse.json(
        { data: null, error: 'Email, password, full name, and role are required.' },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ data: null, error: 'Invalid email format.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json(
        { data: null, error: 'Password must be at least 6 characters long.' },
        { status: 400 },
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message?.includes('already registered')) {
        return NextResponse.json(
          { data: null, error: 'A user with this email already exists.' },
          { status: 409 },
        );
      }
      throw authError;
    }

    // Create user record
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        full_name: fullName,
        email,
        contact_number: contactNumber || null,
        role: role || 'Staff',
        status: 'Active',
      })
      .select()
      .single();

    if (error) {
      // Rollback auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw error;
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to create user.' },
      { status: 500 },
    );
  }
}
