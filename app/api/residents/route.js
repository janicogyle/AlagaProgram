import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function getMissingResidentsColumn(message) {
  const msg = String(message || '');

  let match = msg.match(/Could not find the '([^']+)' column of 'residents' in the schema cache/i);
  if (match?.[1]) return match[1];

  match = msg.match(/column\s+(?:public\.)?residents\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  match = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?residents"\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  return null;
}

function isMissingBeneficiaryCardsTable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('beneficiary_cards') &&
    (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'))
  );
}

function computeQrValidity({ residentStatus, card }) {
  if (!card) return 'No QR';

  if (card.revoked_at) return 'Revoked';

  const expiresAtMs = card.expires_at ? new Date(card.expires_at).getTime() : NaN;
  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) return 'Expired';

  if (residentStatus && residentStatus !== 'Active') return 'Inactive';

  return 'Valid';
}

export async function GET(request) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const required = new Set(['id', 'control_number', 'first_name', 'last_name']);

    const columns = [
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
      'status',
      'created_at',
      'updated_at',
    ];

    let cols = [...columns];
    let lastError = null;

    for (let attempt = 0; attempt < columns.length; attempt++) {
      const { data, error } = await db
        .from('residents')
        .select(cols.join(', '))
        .order('created_at', { ascending: false });

      if (!error) {
        const residents = Array.isArray(data) ? data : [];
        // continue below for QR enrichment
        lastError = null;
        data && (cols = cols);
        // stash and break
        var residentsData = residents;
        break;
      }

      lastError = error;
      const missing = getMissingResidentsColumn(error.message);
      if (!missing) break;

      if (required.has(missing)) {
        return NextResponse.json(
          {
            data: null,
            error:
              `Database is missing residents.${missing} (or schema cache is stale). Run the latest SQL schema and reload PostgREST:\n\n` +
              `NOTIFY pgrst, 'reload schema';`,
          },
          { status: 500 },
        );
      }

      const idx = cols.indexOf(missing);
      if (idx === -1) break;
      cols.splice(idx, 1);
    }

    if (lastError) throw lastError;

    const residents = residentsData || [];

    if (residents.length === 0) {
      return NextResponse.json({ data: residents, error: null });
    }

    // Optional: attach QR validity status (if beneficiary_cards is set up)
    let cardMap = new Map();
    let cardsStatus = 'not_setup'; // ok | not_setup | unavailable
    try {
      const residentIds = residents.map((r) => r.id).filter(Boolean);
      const { data: cards, error: cardsError } = await db
        .from('beneficiary_cards')
        .select('id, resident_id, issued_at, expires_at, revoked_at, status')
        .in('resident_id', residentIds)
        .order('issued_at', { ascending: false });

      if (cardsError) throw cardsError;
      cardsStatus = 'ok';

      // Pick the latest (already ordered desc)
      for (const c of cards || []) {
        if (!c?.resident_id) continue;
        if (!cardMap.has(c.resident_id)) cardMap.set(c.resident_id, c);
      }
    } catch (err) {
      if (isMissingBeneficiaryCardsTable(err)) {
        cardsStatus = 'not_setup';
      } else {
        cardsStatus = 'unavailable';
        console.warn('Fetch beneficiary_cards failed (continuing without QR status):', err?.message || err);
      }
      cardMap = new Map();
    }

    const enriched = residents.map((r) => {
      const card = cardMap.get(r.id) || null;
      const qr_validity =
        cardsStatus === 'ok'
          ? computeQrValidity({ residentStatus: r.status, card })
          : cardsStatus === 'unavailable'
            ? 'Unavailable'
            : 'Not Setup';

      return {
        ...r,
        qr_validity,
        qr_card: card,
      };
    });

    return NextResponse.json({ data: enriched, error: null });
  } catch (error) {
    console.error('Fetch residents error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch residents.' },
      { status: 500 },
    );
  }
}
