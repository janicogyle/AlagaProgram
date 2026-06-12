import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { verifyBeneficiaryCardToken } from '@/lib/beneficiaryCards.server';
import { computeBeneficiaryIdStatus, getQrScanStatus } from '@/lib/beneficiaryIdStatus.server';

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

const LATEST_REQUEST_FIELDS = [
  'id',
  'control_number',
  'requester_name',
  'beneficiary_name',
  'assistance_type',
  'amount',
  'status',
  'request_date',
  'created_at',
];

const LATEST_REQUEST_OPTIONAL_FIELDS = [
  'requester_contact',
  'requester_address',
  'beneficiary_contact',
  'beneficiary_address',
  'valid_id_url',
  'requirements_urls',
  'requirements_files',
  'requirements_checklist',
  'requirements_completed',
  'processed_by',
  'decision_remarks',
  'request_source',
];

function getMissingAssistanceRequestsColumn(message) {
  const msg = String(message || '');

  let match = msg.match(/Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i);
  if (match?.[1]) return match[1];

  match = msg.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  match = msg.match(
    /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?assistance_requests"\s+does\s+not\s+exist/i,
  );
  if (match?.[1]) return match[1];

  return null;
}

function extractVerificationValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  try {
    const url = new URL(text);
    return (
      url.searchParams.get('cardRef') ||
      url.searchParams.get('cardReference') ||
      url.searchParams.get('ref') ||
      url.searchParams.get('token') ||
      url.hash.replace(/^#/, '') ||
      text
    ).trim();
  } catch {
    return text;
  }
}

function decodeTokenPayload(token) {
  const [payloadB64] = String(token || '').split('.');
  if (!payloadB64) return null;

  try {
    let base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    if (pad) base64 += '='.repeat(4 - pad);
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

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

async function loadLatestAssistanceRequest(residentId) {
  if (!residentId || !supabaseAdmin) return null;

  let fields = [...LATEST_REQUEST_FIELDS, ...LATEST_REQUEST_OPTIONAL_FIELDS];
  let data = null;
  let error = null;

  for (let attempt = 0; attempt <= LATEST_REQUEST_OPTIONAL_FIELDS.length; attempt++) {
    ;({ data, error } = await supabaseAdmin
      .from('assistance_requests')
      .select(fields.join(', '))
      .eq('resident_id', residentId)
      .order('request_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle());

    if (!error) break;

    const missing = getMissingAssistanceRequestsColumn(error.message);
    if (!missing || !LATEST_REQUEST_OPTIONAL_FIELDS.includes(missing)) break;

    fields = fields.filter((field) => field !== missing);
  }

  if (error) throw error;
  return data || null;
}

async function buildVerificationPayload(base) {
  const residentId = base?.resident?.id || base?.card?.resident_id;
  if (!residentId) {
    return { ...base, resident: base?.resident || null, releasedHistory: [], latestAssistanceRequest: null };
  }

  const next = {
    ...base,
    resident: base?.resident || null,
    releasedHistory: [],
    latestAssistanceRequest: null,
  };

  const hasProfile = base?.resident && Object.prototype.hasOwnProperty.call(base.resident, 'first_name');
  if (!hasProfile) {
    try {
      next.resident = await loadResidentProfile(residentId);
    } catch (profileError) {
      console.warn('Verify card profile load failed:', profileError?.message || profileError);
      next.profileWarning = 'Could not load full beneficiary profile.';
    }
  }

  try {
    next.releasedHistory = await loadReleasedHistory(residentId);
  } catch (historyError) {
    console.warn('Verify card released assistance history load failed:', historyError?.message || historyError);
  }

  try {
    next.latestAssistanceRequest = await loadLatestAssistanceRequest(residentId);
  } catch (requestError) {
    console.warn('Verify card latest assistance request load failed:', requestError?.message || requestError);
  }

  return next;
}

async function handleCardVerification(cardData, supabaseAdminClient) {
  const resident = await loadResidentProfile(cardData.resident_id);
  const idStatus = computeBeneficiaryIdStatus({ card: cardData, residentStatus: resident?.status });
  const scanStatus = getQrScanStatus(idStatus);

  if (cardData.revoked_at) {
    const payload = await buildVerificationPayload({
      valid: false,
      reason: scanStatus.reason || 'expired',
      idStatus,
      scanStatus: scanStatus.label,
      card: cardData,
      resident,
    });
    return NextResponse.json({ data: payload, error: null }, { status: 200 });
  }

  if (!scanStatus.valid) {
    const payload = await buildVerificationPayload({
      valid: false,
      reason: scanStatus.reason,
      idStatus,
      scanStatus: scanStatus.label,
      card: cardData,
      resident,
    });
    return NextResponse.json({ data: payload, error: null }, { status: 200 });
  }

  const payload = await buildVerificationPayload({
    valid: true,
    reason: null,
    idStatus,
    scanStatus: scanStatus.label,
    card: cardData,
    resident: resident || null,
  });
  return NextResponse.json({ data: payload, error: null }, { status: 200 });
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

    const rawToken = extractVerificationValue(body?.token);
    if (!rawToken) {
      return NextResponse.json({ data: null, error: 'Token or card reference is required.' }, { status: 400 });
    }

    const hasSecret = !!(process.env.QR_CARD_SECRET || process.env.BENEFICIARY_SESSION_SECRET);

    // Check if it's a card reference (short alphanumeric) or a full token
    const cardReference = rawToken.toUpperCase();
    const isCardReference = /^[A-Z0-9]{6,10}$/.test(cardReference);

    let cardData;
    let cardError;

    if (isCardReference) {
      // Handle card reference lookup by card ID prefix
      // Card Ref is the first 8 characters of the UUID ID (e.g., "F7196677" from "f7196677-xxxx-...")
      const { data: cardsList, error: cardsError } = await supabaseAdmin
        .from('beneficiary_cards')
        .select('id, resident_id, issued_at, expires_at, revoked_at, status')
        .order('issued_at', { ascending: false })
        .limit(100);

      if (cardsError || !cardsList) {
        return NextResponse.json(
          { data: { valid: false, reason: 'card_not_found' }, error: null },
          { status: 200 },
        );
      }

      // Find card where first 8 chars of ID match the reference
      const matchedCard = cardsList.find((card) => 
        String(card.id || '').slice(0, 8).toUpperCase() === cardReference
      );

      if (!matchedCard) {
        return NextResponse.json(
          { data: { valid: false, reason: 'card_not_found' }, error: null },
          { status: 200 },
        );
      }

      cardData = matchedCard;
      cardError = null;
    } else {
      // Handle full token verification
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

      const verified = verifyBeneficiaryCardToken(rawToken);
      if (!verified.ok) {
        const unsignedPayload = decodeTokenPayload(rawToken);
        if (unsignedPayload?.typ !== 'beneficiary-card' || !unsignedPayload?.cid) {
          return NextResponse.json(
            { data: { valid: false, reason: verified.reason }, error: null },
            { status: 200 },
          );
        }

        const exp = Number(unsignedPayload.exp);
        if (Number.isFinite(exp) && exp < Math.floor(Date.now() / 1000)) {
          return NextResponse.json(
            { data: { valid: false, reason: 'expired' }, error: null },
            { status: 200 },
          );
        }

        verified.payload = unsignedPayload;
      }

      const cardId = String(verified.payload.cid);

      const result = await supabaseAdmin
        .from('beneficiary_cards')
        .select('id, resident_id, issued_at, expires_at, revoked_at, status')
        .eq('id', cardId)
        .single();

      cardData = result.data;
      cardError = result.error;
    }

    if (cardError || !cardData) {
      return NextResponse.json(
        { data: { valid: false, reason: 'not_found' }, error: null },
        { status: 200 },
      );
    }

    return handleCardVerification(cardData, supabaseAdmin);
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
