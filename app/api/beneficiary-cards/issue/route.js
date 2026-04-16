import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const host = supabaseUrl
    ? supabaseUrl.replace(/^https?:\/\//, '').replace(/\/.*/, '')
    : '(missing NEXT_PUBLIC_SUPABASE_URL)';

  return (
    "QR ID cards are not set up in the database yet. " +
    "Run setup-step5.sql in Supabase SQL Editor, wait a moment (schema cache reload), then try again. " +
    `Your app is currently connected to: ${host}. ` +
    "If you ran the SQL in a different Supabase project, it won’t work—run it in the project shown above."
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
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

    const residentId = body?.residentId;
    const expiresInDaysRaw = body?.expiresInDays;

    if (!residentId || !isUuid(residentId)) {
      return NextResponse.json({ data: null, error: 'Valid residentId is required.' }, { status: 400 });
    }

    const expiresInDays = Number.isFinite(Number(expiresInDaysRaw))
      ? Number(expiresInDaysRaw)
      : 365;

    if (expiresInDays < 1 || expiresInDays > 3650) {
      return NextResponse.json(
        { data: null, error: 'expiresInDays must be between 1 and 3650.' },
        { status: 400 },
      );
    }

    // Ensure resident exists
    const { data: resident, error: residentError } = await supabaseAdmin
      .from('residents')
      .select('id, first_name, last_name, status')
      .eq('id', residentId)
      .single();

    if (residentError || !resident) {
      return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
    }

    if (resident.status && resident.status !== 'Active') {
      return NextResponse.json(
        { data: null, error: 'Beneficiary account is not active.' },
        { status: 403 },
      );
    }

    const nowIso = new Date().toISOString();

    // Revoke existing active cards for this resident (single active card at a time)
    const { error: revokeError } = await supabaseAdmin
      .from('beneficiary_cards')
      .update({ revoked_at: nowIso, status: 'Revoked' })
      .eq('resident_id', residentId)
      .is('revoked_at', null);

    if (revokeError) throw revokeError;

    const expiresAtIso = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: card, error: insertError } = await supabaseAdmin
      .from('beneficiary_cards')
      .insert({ resident_id: residentId, issued_at: nowIso, expires_at: expiresAtIso, status: 'Active' })
      .select('id, resident_id, issued_at, expires_at, revoked_at, status')
      .single();

    if (insertError) throw insertError;

    const hasSecret = !!(process.env.QR_CARD_SECRET || process.env.BENEFICIARY_SESSION_SECRET);
    if (!hasSecret) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Missing QR token signing secret. Set QR_CARD_SECRET in .env.local (server-side), then restart the dev server (pnpm dev).',
          code: 'QR_CARD_SECRET_MISSING',
        },
        { status: 500 },
      );
    }

    const token = createBeneficiaryCardToken(card.id, card.expires_at);

    return NextResponse.json({ data: { card, token }, error: null });
  } catch (err) {
    console.error('Issue beneficiary card error:', err);

    if (isMissingBeneficiaryCardsTable(err)) {
      return NextResponse.json(
        { data: null, error: setupHint(), code: 'BENEFICIARY_CARDS_TABLE_MISSING' },
        { status: 503 },
      );
    }

    return NextResponse.json({ data: null, error: err.message || 'Failed to issue card.' }, { status: 500 });
  }
}
