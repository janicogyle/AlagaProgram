import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { createBeneficiaryCardToken } from '@/lib/beneficiaryCards.server';

export const runtime = 'nodejs';

function isMissingBeneficiaryCardsTable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('beneficiary_cards') &&
    (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'))
  );
}

function setupHint() {
  return 'Beneficiary ID (QR) is not enabled yet. Please ask the barangay office/admin to run the database setup (setup-step5.sql).';
}

export async function GET(request) {
  try {
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

    const session = readBeneficiarySession(request);
    if (!session.ok) {
      return NextResponse.json({ data: null, error: session.error || 'Unauthorized.' }, { status: 401 });
    }

    const residentId = session.residentId;

    const { data: card, error } = await supabaseAdmin
      .from('beneficiary_cards')
      .select('id, resident_id, issued_at, expires_at, revoked_at, status')
      .eq('resident_id', residentId)
      .is('revoked_at', null)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!card) {
      return NextResponse.json(
        { data: null, error: 'No active ID card found. Please request issuance at the barangay office.' },
        { status: 404 },
      );
    }

    const now = Date.now();
    const expiresAtMs = new Date(card.expires_at).getTime();
    if (Number.isFinite(expiresAtMs) && expiresAtMs < now) {
      return NextResponse.json(
        { data: null, error: 'Your ID card is expired. Please request a renewal.' },
        { status: 410 },
      );
    }

    const hasSecret = !!(process.env.QR_CARD_SECRET || process.env.BENEFICIARY_SESSION_SECRET);
    if (!hasSecret) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Beneficiary ID (QR) is not configured on the server yet. Missing QR_CARD_SECRET. Please contact the administrator.',
          code: 'QR_CARD_SECRET_MISSING',
        },
        { status: 503 },
      );
    }

    const token = createBeneficiaryCardToken(card.id, card.expires_at);

    return NextResponse.json({ data: { card, token }, error: null });
  } catch (err) {
    console.error('Get beneficiary card (me) error:', err);

    if (isMissingBeneficiaryCardsTable(err)) {
      return NextResponse.json(
        { data: null, error: setupHint(), code: 'BENEFICIARY_CARDS_TABLE_MISSING' },
        { status: 503 },
      );
    }

    return NextResponse.json({ data: null, error: err.message || 'Failed to load ID card.' }, { status: 500 });
  }
}
