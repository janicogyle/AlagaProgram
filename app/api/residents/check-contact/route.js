import { NextResponse } from 'next/server';
import { supabaseAdmin, supabase } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { getWalkInContactUnavailableReason } from '@/lib/contactRegistration.server';

export const runtime = 'nodejs';

/**
 * GET /api/residents/check-contact?contact=09171234567&excludeResidentId=...
 *
 * Returns whether the contact number is available for walk-in registration.
 * Used by the admin registration page to block duplicate contact numbers.
 */
export async function GET(request) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const contact = searchParams.get('contact');
  const excludeResidentId = searchParams.get('excludeResidentId') || '';

  if (!contact || contact.replace(/\D/g, '').length < 10) {
    return NextResponse.json(
      { available: false, error: 'A valid contact number is required.' },
      { status: 400 },
    );
  }

  try {
    const db = supabaseAdmin ?? supabase;
    const reason = await getWalkInContactUnavailableReason(db, contact, {
      excludeResidentId,
    });

    return NextResponse.json({
      available: !reason,
      error: reason || null,
    });
  } catch (error) {
    console.error('Check contact error:', error);
    return NextResponse.json(
      { available: false, error: error.message || 'Failed to check contact number.' },
      { status: 500 },
    );
  }
}
