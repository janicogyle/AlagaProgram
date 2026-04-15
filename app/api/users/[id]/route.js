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

export async function PATCH(request, { params }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        data: null, 
        error: 'Server configuration error. Admin client not available.' 
      }, { status: 500 });
    }

    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ 
        data: null, 
        error: 'User ID is required.'
      }, { status: 400 });
    }

    let updates;
    try {
      updates = await request.json();
    } catch {
      return NextResponse.json({ 
        data: null, 
        error: 'Invalid request body.' 
      }, { status: 400 });
    }

    // Prevent updating certain fields
    delete updates.id;
    delete updates.created_at;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        data: null, 
        error: 'No valid fields to update.' 
      }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ 
          data: null, 
          error: 'User not found.' 
        }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ 
      data: null, 
      error: error.message || 'Failed to update user.' 
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error. Admin client not available.' 
      }, { status: 500 });
    }

    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required.' 
      }, { status: 400 });
    }

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found.' 
      }, { status: 404 });
    }

    // Delete from users table first
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

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
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Failed to delete user.' 
    }, { status: 500 });
  }
}
