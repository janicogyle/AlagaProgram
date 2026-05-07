import { supabaseAdmin } from './supabaseClient';

function ensureAdmin() {
  if (!supabaseAdmin) {
    throw new Error('Admin client not available. This function can only be used server-side with SUPABASE_SERVICE_ROLE_KEY configured.');
  }
  return supabaseAdmin;
}

// Get all admin users
export async function getAllUsers() {
  try {
    const admin = ensureAdmin();
    const { data, error } = await admin
      .from('users')
      .select('id, full_name, email, contact_number, role, status, last_login, created_at')
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

// Create admin user
export async function createUser(userData) {
  try {
    const admin = ensureAdmin();
    const { email, password, fullName, contactNumber, role } = userData;

    if (!email || !password || !fullName || !role) {
      return { data: null, error: new Error('Email, password, full name, and role are required') };
    }

    // Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) return { data: null, error: authError };

    // Create user record
    const { data, error } = await admin
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
      await admin.auth.admin.deleteUser(authData.user.id);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

// Update user
export async function updateUser(userId, updates) {
  try {
    const admin = ensureAdmin();
    
    if (!userId) {
      return { data: null, error: new Error('User ID is required') };
    }

    const { data, error } = await admin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

// Toggle user status
export async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
  return updateUser(userId, { status: newStatus });
}

// Reset password
export async function resetUserPassword(userId, newPassword) {
  try {
    const admin = ensureAdmin();
    
    if (!userId || !newPassword) {
      return { data: null, error: new Error('User ID and new password are required') };
    }

    if (newPassword.length < 6) {
      return { data: null, error: new Error('Password must be at least 6 characters') };
    }

    const { data, error } = await admin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

// Delete user
export async function deleteUser(userId) {
  try {
    const admin = ensureAdmin();
    
    if (!userId) {
      return { data: null, error: new Error('User ID is required') };
    }

    // Delete from users table first
    const { error: dbError } = await admin.from('users').delete().eq('id', userId);
    
    if (dbError) {
      return { data: null, error: dbError };
    }

    // Delete from auth
    const { data, error } = await admin.auth.admin.deleteUser(userId);

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}
