import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { isSignupContactAvailable } from '@/lib/contactRegistration.server';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const contactNumber = searchParams.get('contactNumber') || searchParams.get('contact_number');

    const { available, error } = await isSignupContactAvailable(db, contactNumber);

    return NextResponse.json({
      data: { available, error: available ? null : error },
      error: null,
    });
  } catch (err) {
    console.error('Check contact error:', err);
    return NextResponse.json(
      { data: null, error: err?.message || 'Failed to check contact number.' },
      { status: 500 },
    );
  }
}
