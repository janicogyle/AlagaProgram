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

const RESIDENT_FIELDS = [
  'id',
  'control_number',
  'first_name',
  'middle_name',
  'last_name',
  'birthday',
  'age',
  'birthplace',
  'sex',
  'citizenship',
  'civil_status',
  'contact_number',
  'house_no',
  'purok',
  'barangay',
  'city',
  'is_pwd',
  'is_senior_citizen',
  'is_solo_parent',
  'representative_name',
  'representative_contact',
  'status',
  'created_at',
].join(', ');

const HISTORY_FIELDS = [
  'id',
  'control_number',
  'requester_name',
  'beneficiary_name',
  'assistance_type',
  'amount',
  'status',
  'request_date',
  'created_at',
].join(', ');

async function loadResidentProfile(residentId) {
  if (!residentId || !supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('residents')
    .select(RESIDENT_FIELDS)
    .eq('id', residentId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadReleasedHistory(residentId) {
  if (!residentId || !supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('assistance_requests')
    .select(HISTORY_FIELDS)
    .eq('resident_id', residentId)
    .eq('status', 'Released')
    .order('request_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

async function buildVerificationPayload(base) {
  const residentId = base?.resident?.id || base?.card?.resident_id;
  if (!residentId) {
    return { ...base, resident: base?.resident || null, releasedHistory: [] };
  }

  try {
    const hasProfile = base?.resident && Object.prototype.hasOwnProperty.call(base.resident, 'first_name');
    const [resident, releasedHistory] = await Promise.all([
      hasProfile ? Promise.resolve(base.resident) : loadResidentProfile(residentId),
      loadReleasedHistory(residentId),
    ]);

    return {
      ...base,
      resident: resident || base.resident || null,
      releasedHistory,
    };
  } catch (profileError) {
    console.warn('Verify card profile/history load failed:', profileError?.message || profileError);
    return {
      ...base,
      resident: base?.resident || null,
      releasedHistory: [],
      profileWarning: 'Could not load full beneficiary profile or request history.',
    };
  }
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
      .select('id, resident_id, issued_at, expires_at, revoked_at, status')
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
      const payload = await buildVerificationPayload({
        valid: false,
        reason: 'revoked',
        card: data,
        resident: null,
      });
      return NextResponse.json({ data: payload, error: null }, { status: 200 });
    }

    if (Number.isFinite(expiresAtMs) && expiresAtMs < now) {
      const payload = await buildVerificationPayload({
        valid: false,
        reason: 'expired',
        card: data,
        resident: null,
      });
      return NextResponse.json({ data: payload, error: null }, { status: 200 });
    }

    const resident = await loadResidentProfile(data.resident_id);

    if (resident?.status && resident.status !== 'Active') {
      const payload = await buildVerificationPayload({
        valid: false,
        reason: 'inactive',
        card: data,
        resident,
      });
      return NextResponse.json({ data: payload, error: null }, { status: 200 });
    }

    const payload = await buildVerificationPayload({
      valid: true,
      reason: null,
      card: data,
      resident: resident || null,
    });
    return NextResponse.json({ data: payload, error: null }, { status: 200 });
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
