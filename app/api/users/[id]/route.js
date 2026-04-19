import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ data: null, error: 'User ID is required.' }, { status: 400 });
    }

    let updates;
    try {
      updates = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    // Prevent updating certain fields
    delete updates.id;
    delete updates.created_at;

    const allowedKeys = new Set(['full_name', 'contact_number', 'role', 'status', 'email']);
    Object.keys(updates).forEach((key) => {
      if (!allowedKeys.has(key)) delete updates[key];
    });

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: null, error: 'No valid fields to update.' }, { status: 400 });
    }

    const email = typeof updates.email === 'string' ? updates.email.trim() : undefined;

    // Email updates must also update Supabase Auth.
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ data: null, error: 'Invalid email format.' }, { status: 400 });
      }
    }

    // Fetch current profile for rollback + to detect no-op email change
    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (existingError || !existingUser) {
      return NextResponse.json({ data: null, error: 'User not found.' }, { status: 404 });
    }

    const oldEmail = existingUser.email;
    const wantsEmailChange = email !== undefined && email !== oldEmail;

    // 1) Update auth email first (so login is updated)
    if (wantsEmailChange) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
      });
      if (authError) {
        return NextResponse.json(
          { data: null, error: authError.message || 'Failed to update auth email.' },
          { status: 400 },
        );
      }
    }

    // 2) Update public.users table
    if (email !== undefined) updates.email = email;

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      // Attempt rollback of auth email if DB update fails after changing auth.
      if (wantsEmailChange) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, { email: oldEmail, email_confirm: true });
        } catch {
          // ignore rollback failures
        }
      }

      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null, error: 'User not found.' }, { status: 404 });
      }

      // Unique violation for email
      if (error.code === '23505') {
        return NextResponse.json({ data: null, error: 'A user with this email already exists.' }, { status: 409 });
      }

      throw error;
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to update user.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Delete from users table first
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', userId);

    if (dbError) throw dbError;

    // Delete from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Auth deletion failed:', authError);
      // Continue even if auth deletion fails (user record already deleted)
    }

    return NextResponse.json({ success: true, error: null });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user.' },
      { status: 500 },
    );
  }
}
