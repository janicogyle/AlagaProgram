import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { verifyBeneficiaryCardToken } from '@/lib/beneficiaryCards.server';

export const runtime = 'nodejs';

function isMissingBeneficiaryCardsTable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('beneficiary_cards') &&
    (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'))
  );
}

export async function POST(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Server configuration error. Missing SUPABASE_SERVICE_ROLE_KEY (Supabase admin client not available).',
        },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const token = String(body?.token || '').trim();
    if (!token) {
      return NextResponse.json({ data: null, error: 'Token is required.' }, { status: 400 });
    }

    const hasSecret = !!(process.env.QR_CARD_SECRET || process.env.BENEFICIARY_SESSION_SECRET);
    if (!hasSecret) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Missing QR token signing secret. Set QR_CARD_SECRET in .env.local (server-side), then restart the dev server.',
          code: 'QR_CARD_SECRET_MISSING',
        },
        { status: 503 },
      );
    }

    const verified = verifyBeneficiaryCardToken(token);
    if (!verified.ok) {
      return NextResponse.json(
        { data: { valid: false, reason: verified.reason }, error: null },
        { status: 200 },
      );
    }

    const cardId = String(verified.payload.cid);

    const { data, error } = await supabaseAdmin
      .from('beneficiary_cards')
      .select(
        `id, resident_id, issued_at, expires_at, revoked_at, status,
         resident:residents (id, control_number, first_name, middle_name, last_name, birthday, contact_number, status)`
      )
      .eq('id', cardId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { data: { valid: false, reason: 'not_found' }, error: null },
        { status: 200 },
      );
    }

    const now = Date.now();
    const expiresAtMs = new Date(data.expires_at).getTime();

    if (data.revoked_at) {
      return NextResponse.json(
        { data: { valid: false, reason: 'revoked', card: data, resident: data.resident }, error: null },
        { status: 200 },
      );
    }

    if (Number.isFinite(expiresAtMs) && expiresAtMs < now) {
      return NextResponse.json(
        { data: { valid: false, reason: 'expired', card: data, resident: data.resident }, error: null },
        { status: 200 },
      );
    }

    if (data.resident?.status && data.resident.status !== 'Active') {
      return NextResponse.json(
        { data: { valid: false, reason: 'inactive', card: data, resident: data.resident }, error: null },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { data: { valid: true, reason: null, card: data, resident: data.resident }, error: null },
      { status: 200 },
    );
  } catch (err) {
    console.error('Verify beneficiary card error:', err);

    if (isMissingBeneficiaryCardsTable(err)) {
      return NextResponse.json(
        { data: { valid: false, reason: 'not_setup' }, error: null },
        { status: 200 },
      );
    }

    return NextResponse.json({ data: null, error: err.message || 'Failed to verify card.' }, { status: 500 });
  }
}
