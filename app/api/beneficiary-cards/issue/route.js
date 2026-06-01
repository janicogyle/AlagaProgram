import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import {
  getBeneficiaryCardsSetupHint,
  isMissingBeneficiaryCardsTable,
  issueBeneficiaryCard,
} from '@/lib/beneficiaryCards.server';

export const runtime = 'nodejs';

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

    const { card, token } = await issueBeneficiaryCard(supabaseAdmin, residentId, { expiresInDays });
    return NextResponse.json({ data: { card, token }, error: null });
  } catch (err) {
    console.error('Issue beneficiary card error:', err);

    if (isMissingBeneficiaryCardsTable(err)) {
      return NextResponse.json(
        { data: null, error: getBeneficiaryCardsSetupHint(), code: 'BENEFICIARY_CARDS_TABLE_MISSING' },
        { status: 503 },
      );
    }

    if (err?.code === 'QR_CARD_SECRET_MISSING') {
      return NextResponse.json({ data: null, error: err.message, code: err.code }, { status: 500 });
    }

    return NextResponse.json({ data: null, error: err.message || 'Failed to issue card.' }, { status: 500 });
  }
}
