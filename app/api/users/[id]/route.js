import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';
import { logStaffActivity } from '@/lib/activityLogger.server';
import { normalizeSectorAccess } from '@/lib/sectorAccess';

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

    const requestedRole = updates.role;
    const sectorAccess = requestedRole === 'Staff'
      ? normalizeSectorAccess(updates.sector_access ?? updates.sectorAccess)
      : [];
    const allowedKeys = new Set(['full_name', 'contact_number', 'role', 'status', 'email', 'sector_access']);
    Object.keys(updates).forEach((key) => {
      if (!allowedKeys.has(key)) delete updates[key];
    });

    if (requestedRole === 'Staff') {
      if ((updates.status || 'Active') === 'Active' && sectorAccess.length === 0) {
        return NextResponse.json(
          { data: null, error: 'Assign at least one sector for active Staff accounts.' },
          { status: 400 },
        );
      }
      updates.sector_access = sectorAccess;
    } else if (requestedRole === 'Admin') {
      updates.sector_access = [];
    } else {
      delete updates.sector_access;
    }

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
      .select('id, email, role, status, sector_access')
      .eq('id', userId)
      .single();

    if (existingError || !existingUser) {
      return NextResponse.json({ data: null, error: 'User not found.' }, { status: 404 });
    }

    const oldEmail = existingUser.email;
    const wantsEmailChange = email !== undefined && email !== oldEmail;
    const effectiveRole = updates.role || existingUser.role;
    const effectiveStatus = updates.status || existingUser.status;
    const effectiveSectorAccess =
      effectiveRole === 'Staff'
        ? (updates.sector_access ? normalizeSectorAccess(updates.sector_access) : normalizeSectorAccess(existingUser.sector_access))
        : [];

    if (effectiveRole === 'Staff' && effectiveStatus === 'Active' && effectiveSectorAccess.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Assign at least one sector for active Staff accounts.' },
        { status: 400 },
      );
    }

    if (effectiveRole === 'Staff') {
      updates.sector_access = effectiveSectorAccess;
    } else if (effectiveRole === 'Admin') {
      updates.sector_access = [];
    }

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

    await logStaffActivity(
      auth,
      {
        action: 'Updated user account',
        message: 'Admin user account details were updated.',
        entity_type: 'user',
        entity_id: data?.id || userId,
        reference_number: data?.email || email || userId,
        link: '/admin/users',
        audience_user_id: data?.id || userId,
      },
      supabaseAdmin,
    );

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

    await logStaffActivity(
      auth,
      {
        action: 'Deleted user account',
        message: 'Admin user account was deleted.',
        entity_type: 'user',
        entity_id: userId,
        reference_number: userId,
        link: '/admin/users',
      },
      supabaseAdmin,
    );

    return NextResponse.json({ success: true, error: null });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete user.' },
      { status: 500 },
    );
  }
}
