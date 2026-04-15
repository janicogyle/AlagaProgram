import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

export async function POST(request, { params }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error. Admin client not available.' 
      }, { status: 500 });
    }

    const { id: userId } = await params;
    const { newPassword } = await request.json();

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required.' 
      }, { status: 400 });
    }

    if (!newPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'New password is required.' 
      }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password must be at least 6 characters long.' 
      }, { status: 400 });
    }

    // Check if user exists first
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found.' 
      }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (error) {
      if (error.message?.includes('not found')) {
        return NextResponse.json({ 
          success: false, 
          error: 'User not found in auth system.' 
        }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      error: null, 
      message: `Password for ${existingUser.full_name} reset successfully.` 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to reset password.' 
    }, { status: 500 });
  }
}
