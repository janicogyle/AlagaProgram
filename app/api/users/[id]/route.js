import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin, verifyUserPassword } from '@/lib/apiAuth';
import { logStaffActivity } from '@/lib/activityLogger.server';
import { normalizeSectorAccess } from '@/lib/sectorAccess';
import { getRoleSectorAccess, isCreatableUserRole } from '@/lib/userRoles';

const ACCOUNT_ACTION_MIN_AGE_MS = 24 * 60 * 60 * 1000;

function isAccountTooNew(createdAt) {
  const createdAtMs = Date.parse(createdAt);
  return !Number.isFinite(createdAtMs) || Date.now() - createdAtMs < ACCOUNT_ACTION_MIN_AGE_MS;
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ data: null, error: 'User ID is required.' }, { status: 400 });
    }

    let updates;
    let adminPassword;
    try {
      const body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
      adminPassword = body.adminPassword;
      updates = { ...body };
      delete updates.adminPassword;
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    // Prevent updating certain fields
    delete updates.id;
    delete updates.created_at;

    delete updates.sectorAccess;
    const allowedKeys = new Set(['full_name', 'contact_number', 'role', 'status', 'email', 'sector_access']);
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
      .select('id, email, role, status, sector_access, created_at')
      .eq('id', userId)
      .single();

    if (existingError || !existingUser) {
      return NextResponse.json({ data: null, error: 'User not found.' }, { status: 404 });
    }

    const isDeactivation = existingUser.status === 'Active' && updates.status === 'Inactive';
    if (isDeactivation) {
      if (isAccountTooNew(existingUser.created_at)) {
        return NextResponse.json(
          { data: null, error: 'An account must be at least 24 hours old before it can be deactivated.' },
          { status: 409 },
        );
      }

      if (existingUser.role === 'Admin') {
        const { count: activeAdminCount, error: countError } = await supabaseAdmin
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'Admin')
          .eq('status', 'Active');

        if (countError) throw countError;
        if ((activeAdminCount || 0) <= 1) {
          return NextResponse.json(
            { data: null, error: 'The last active administrator cannot be deactivated.' },
            { status: 409 },
          );
        }
      }

      if (typeof adminPassword !== 'string' || !adminPassword.trim()) {
        return NextResponse.json(
          { data: null, error: 'Your admin password is required to deactivate an account.' },
          { status: 400 },
        );
      }

      const passwordCheck = await verifyUserPassword(auth.profile.email, adminPassword);
      if (!passwordCheck.ok) {
        return NextResponse.json(
          { data: null, error: passwordCheck.error || 'Admin password verification failed.' },
          { status: 403 },
        );
      }
    }

    const requestedRole = updates.role;
    const keepsExistingLegacyRole =
      requestedRole === 'Staff' && existingUser.role === 'Staff';
    if (requestedRole && !isCreatableUserRole(requestedRole) && !keepsExistingLegacyRole) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Invalid role. Choose Admin, PWD Coordinator, Solo Parent Coordinator, or Senior Citizen Coordinator.',
        },
        { status: 400 },
      );
    }

    const oldEmail = existingUser.email;
    const wantsEmailChange = email !== undefined && email !== oldEmail;
    const effectiveRole = requestedRole || existingUser.role;
    const effectiveStatus = updates.status || existingUser.status;
    const requestedSectorAccess =
      updates.sector_access === undefined
        ? existingUser.sector_access
        : normalizeSectorAccess(updates.sector_access);
    const effectiveSectorAccess = getRoleSectorAccess(effectiveRole, requestedSectorAccess);

    if (effectiveRole !== 'Admin' && effectiveStatus === 'Active' && effectiveSectorAccess.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Active coordinator accounts must have an assigned sector.' },
        { status: 400 },
      );
    }

    updates.sector_access = effectiveSectorAccess;

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

    let body;
    try {
      body = await request.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    } catch {
      return NextResponse.json(
        { success: false, error: 'Your admin password is required to remove an account.' },
        { status: 400 },
      );
    }

    if (typeof body.adminPassword !== 'string' || !body.adminPassword.trim()) {
      return NextResponse.json(
        { success: false, error: 'Your admin password is required to remove an account.' },
        { status: 400 },
      );
    }

    const passwordCheck = await verifyUserPassword(auth.profile.email, body.adminPassword);
    if (!passwordCheck.ok) {
      return NextResponse.json(
        { success: false, error: passwordCheck.error || 'Admin password verification failed.' },
        { status: 403 },
      );
    }

    // Capture the profile before deletion for validation and the audit trail.
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, status, created_at')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (isAccountTooNew(existingUser.created_at)) {
      return NextResponse.json(
        { success: false, error: 'An account must be at least 24 hours old before it can be removed.' },
        { status: 409 },
      );
    }

    if (existingUser.role === 'Admin' && existingUser.status === 'Active') {
      const { count: activeAdminCount, error: countError } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'Admin')
        .eq('status', 'Active');

      if (countError) throw countError;
      if ((activeAdminCount || 0) <= 1) {
        return NextResponse.json(
          { success: false, error: 'The last active administrator cannot be removed.' },
          { status: 409 },
        );
      }
    }

    // Deleting the Auth identity cascades to public.users and other linked account data.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) {
      throw new Error(authError.message || 'Failed to remove the authentication account.');
    }

    // Keep this explicit cleanup for installations where the cascade was not configured.
    const { error: dbError } = await supabaseAdmin.from('users').delete().eq('id', userId);
    if (dbError) throw dbError;

    await logStaffActivity(
      auth,
      {
        action: 'Deleted user account',
        message: `Deleted ${existingUser.role} account for ${existingUser.full_name}.`,
        entity_type: 'user',
        entity_id: userId,
        reference_number: existingUser.email,
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
