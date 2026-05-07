import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/passwords.server';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: residentId } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const newPassword = body?.newPassword;

    if (!residentId) {
      return NextResponse.json({ success: false, error: 'Resident ID is required.' }, { status: 400 });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 },
      );
    }

    const { data: existing, error: fetchError } = await db
      .from('residents')
      .select('id')
      .eq('id', residentId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: 'Beneficiary not found.' }, { status: 404 });
    }

    const password_hash = await hashPassword(newPassword);

    const { error: updateError } = await db
      .from('residents')
      .update({ password_hash })
      .eq('id', residentId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, error: null, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Reset resident password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset password.' },
      { status: 500 },
    );
  }
}
