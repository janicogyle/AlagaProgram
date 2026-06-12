import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function mapRequest(row) {
  return {
    ...row,
    resident: Array.isArray(row?.residents) ? row.residents[0] : row?.residents || null,
    card: Array.isArray(row?.beneficiary_cards) ? row.beneficiary_cards[0] : row?.beneficiary_cards || null,
  };
}

function isMissingRenewalTableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    (
      message.includes('beneficiary_id_renewal_requests') &&
      (message.includes('schema cache') || message.includes('does not exist') || message.includes('could not find the table'))
    )
  );
}

export async function GET(request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    if (!supabaseAdmin) {
      return NextResponse.json({ data: null, error: 'Server configuration error. Database admin client not available.' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get('status') || '').trim();

    let query = supabaseAdmin
      .from('beneficiary_id_renewal_requests')
      .select(`
        id,
        resident_id,
        card_id,
        current_expires_at,
        updated_valid_id_url,
        remarks,
        status,
        admin_remarks,
        processed_by,
        processed_at,
        created_at,
        updated_at,
        residents:resident_id(id, control_number, first_name, middle_name, last_name, contact_number, status),
        beneficiary_cards:card_id(id, issued_at, expires_at, status, revoked_at)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: (data || []).map(mapRequest), error: null });
  } catch (error) {
    console.error('Fetch renewal requests error:', error);
    if (isMissingRenewalTableError(error)) {
      return NextResponse.json(
        {
          data: [],
          error: 'Renewal Requests table is not set up yet. Run setup-step14-beneficiary-id-renewals.sql in Supabase SQL Editor, then refresh the schema cache or reload this page.',
          code: 'RENEWAL_REQUESTS_TABLE_MISSING',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ data: null, error: error?.message || 'Failed to fetch renewal requests.' }, { status: 500 });
  }
}
