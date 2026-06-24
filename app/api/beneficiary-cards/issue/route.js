import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import {
  getBeneficiaryCardsSetupHint,
  isMissingBeneficiaryCardsTable,
  issueBeneficiaryCard,
} from '@/lib/beneficiaryCards.server';
import { logStaffActivity } from '@/lib/activityLogger.server';
import { forbiddenSectorResponse, rowMatchesSectorAccess } from '@/lib/sectorAccess';

export const runtime = 'nodejs';

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('63')) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  if (digits.length > 11) return digits.slice(-11);
  return digits;
}

async function loadResident(residentId) {
  const baseColumns = 'id, first_name, last_name, status, contact_number, is_pwd, is_senior_citizen, is_solo_parent';
  const { data, error } = await supabaseAdmin
    .from('residents')
    .select(`${baseColumns}, account_request_id`)
    .eq('id', residentId)
    .single();

  if (!error) return { data, error: null };

  const msg = String(error?.message || '').toLowerCase();
  const accountRequestColumnMissing =
    msg.includes('account_request_id') &&
    (msg.includes('schema cache') || msg.includes('does not exist'));

  if (!accountRequestColumnMissing) return { data: null, error };

  return supabaseAdmin
    .from('residents')
    .select(baseColumns)
    .eq('id', residentId)
    .single();
}

async function isOnlineResident(resident) {
  if (resident?.account_request_id) return true;

  const contact = normalizeContactNumber(resident?.contact_number);
  if (!contact) return false;

  try {
    const { data, error } = await supabaseAdmin
      .from('account_requests')
      .select('contact_number')
      .eq('status', 'Approved');

    if (error) throw error;
    return (data || []).some((row) => normalizeContactNumber(row?.contact_number) === contact);
  } catch (error) {
    const msg = String(error?.message || error || '').toLowerCase();
    const missing =
      msg.includes('account_requests') &&
      (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'));
    if (!missing) console.warn('Issue card registration type lookup failed:', error?.message || error);
    return false;
  }
}

async function loadCurrentCard(residentId) {
  const { data, error } = await supabaseAdmin
    .from('beneficiary_cards')
    .select('id, resident_id, issued_at, expires_at, revoked_at, status')
    .eq('resident_id', residentId)
    .is('revoked_at', null)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
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
    const action = String(body?.action || body?.mode || '').trim().toLowerCase();
    const isRenewal = action === 'renew' || action === 'renewal';

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

    const { data: resident, error: residentError } = await loadResident(residentId);

    if (residentError || !resident) {
      return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
    }
    if (!rowMatchesSectorAccess(resident, auth.profile)) {
      return forbiddenSectorResponse(NextResponse, 'Beneficiary is outside your assigned sector access.');
    }

    const currentCard = await loadCurrentCard(residentId);
    const onlineResident = await isOnlineResident(resident);
    const isWalkInResident = !onlineResident;

    if (isRenewal && !isWalkInResident) {
      return NextResponse.json(
        { data: null, error: 'Only walk-in beneficiaries can be renewed directly from this page.' },
        { status: 403 },
      );
    }

    if (isRenewal && !currentCard) {
      return NextResponse.json(
        { data: null, error: 'No existing Beneficiary ID card found to renew.' },
        { status: 400 },
      );
    }

    if (isRenewal && resident.status === 'Renewal Pending') {
      return NextResponse.json(
        { data: null, error: 'This beneficiary already has a renewal under review.' },
        { status: 409 },
      );
    }

    if (!isRenewal && resident.status && resident.status !== 'Active') {
      return NextResponse.json(
        { data: null, error: 'Beneficiary account is not active.' },
        { status: 403 },
      );
    }

    const { card, token } = await issueBeneficiaryCard(supabaseAdmin, residentId, { expiresInDays });

    if (isRenewal) {
      const { error: residentUpdateError } = await supabaseAdmin
        .from('residents')
        .update({ status: 'Active' })
        .eq('id', residentId);
      if (residentUpdateError) throw residentUpdateError;
    }

    await logStaffActivity(
      auth,
      {
        action: isRenewal ? 'Renewed beneficiary QR card' : 'Issued beneficiary QR card',
        message: isRenewal
          ? 'Walk-in beneficiary QR ID card was renewed and the old card was replaced.'
          : 'Beneficiary QR ID card was issued.',
        entity_type: 'beneficiary_card',
        entity_id: card?.id || null,
        reference_number: String(card?.id || '').slice(0, 8).toUpperCase() || residentId,
        link: '/admin/residents',
        audience_resident_id: residentId,
      },
      supabaseAdmin,
    );
    return NextResponse.json({ data: { card, token, action: isRenewal ? 'renewed' : 'issued' }, error: null });
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
