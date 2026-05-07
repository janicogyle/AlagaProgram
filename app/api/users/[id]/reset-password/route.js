import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: userId } = await params;
    const { newPassword } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    if (!newPassword) {
      return NextResponse.json({ success: false, error: 'New password is required.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 },
      );
    }

    // Check if user exists first
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

    if (error) {
      if (error.message?.includes('not found')) {
        return NextResponse.json(
          { success: false, error: 'User not found in auth system.' },
          { status: 404 },
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      error: null,
      message: `Password for ${existingUser.full_name} reset successfully.`,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset password.' },
      { status: 500 },
    );
  }
}
