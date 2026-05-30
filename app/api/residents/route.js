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

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('63')) {
    return `0${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `0${digits}`;
  }

  if (digits.length > 11) {
    return digits.slice(-11);
  }

  return digits;
}

function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function applyResidentFilters(query, { search, sector }) {
  let nextQuery = query;
  const term = String(search || '').trim();
  if (term) {
    const escaped = term.replace(/[%_]/g, (match) => `\\${match}`);
    nextQuery = nextQuery.or(
      [
        `first_name.ilike.%${escaped}%`,
        `middle_name.ilike.%${escaped}%`,
        `last_name.ilike.%${escaped}%`,
        `control_number.ilike.%${escaped}%`,
        `contact_number.ilike.%${escaped}%`,
      ].join(','),
    );
  }

  if (sector === 'PWD') nextQuery = nextQuery.eq('is_pwd', true);
  if (sector === 'Senior Citizen') nextQuery = nextQuery.eq('is_senior_citizen', true);
  if (sector === 'Solo Parent') nextQuery = nextQuery.eq('is_solo_parent', true);

  return nextQuery;
}

function applyResidentSort(query, sortBy) {
  if (sortBy === 'name_asc' || sortBy === 'name_desc') {
    const ascending = sortBy === 'name_asc';
    return query
      .order('last_name', { ascending })
      .order('first_name', { ascending })
      .order('created_at', { ascending: false });
  }

  if (sortBy === 'control_asc' || sortBy === 'control_desc') {
    return query.order('control_number', { ascending: sortBy === 'control_asc' });
  }

  return query.order('created_at', { ascending: sortBy === 'created_asc' });
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

    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const hasPagination = pageParam != null || pageSizeParam != null;
    const page = parsePositiveInt(pageParam, 1, { min: 1, max: 100000 });
    const pageSize = parsePositiveInt(pageSizeParam, 25, { min: 1, max: 100 });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const search = searchParams.get('search') || '';
    const sector = searchParams.get('sector') || '';
    const sortBy = searchParams.get('sortBy') || 'created_desc';

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
      'account_request_id',
      'status',
      'created_at',
      'updated_at',
    ];

    let cols = [...columns];
    let lastError = null;
    let residentsCount = null;

    for (let attempt = 0; attempt < columns.length; attempt++) {
      let query = db
        .from('residents')
        .select(cols.join(', '), hasPagination ? { count: 'exact' } : undefined);

      query = applyResidentFilters(query, { search, sector });
      query = applyResidentSort(query, sortBy);
      if (hasPagination) query = query.range(from, to);

      const { data, error, count } = await query;

      if (!error) {
        const residents = Array.isArray(data) ? data : [];
        // continue below for QR enrichment
        lastError = null;
        data && (cols = cols);
        residentsCount = typeof count === 'number' ? count : residents.length;
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
      return NextResponse.json({
        data: residents,
        error: null,
        meta: hasPagination
          ? { page, pageSize, total: residentsCount || 0, totalPages: 0 }
          : undefined,
      });
    }

    let approvedSignupContacts = new Set();
    try {
      const contacts = residents
        .map((r) => normalizeContactNumber(r.contact_number))
        .filter((contact) => contact && contact.length >= 10);

      if (contacts.length) {
        const { data: approvedRequests, error: requestsError } = await db
          .from('account_requests')
          .select('contact_number')
          .eq('status', 'Approved')
          .in('contact_number', Array.from(new Set(contacts)));

        if (requestsError) throw requestsError;

        approvedSignupContacts = new Set(
          (approvedRequests || [])
            .map((row) => normalizeContactNumber(row.contact_number))
            .filter(Boolean),
        );
      }
    } catch (err) {
      const msg = String(err?.message || err || '').toLowerCase();
      const missing =
        msg.includes('account_requests') &&
        (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'));
      if (!missing) {
        console.warn('Fetch account_requests for registration type failed (continuing):', err?.message || err);
      }
      approvedSignupContacts = new Set();
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
        registration_type:
          r.account_request_id || approvedSignupContacts.has(normalizeContactNumber(r.contact_number))
            ? 'Online'
            : 'Walk-In',
        qr_validity,
        qr_card: card,
      };
    });

    return NextResponse.json({
      data: enriched,
      error: null,
      meta: hasPagination
        ? {
            page,
            pageSize,
            total: residentsCount || 0,
            totalPages: Math.ceil((residentsCount || 0) / pageSize),
          }
        : undefined,
    });
  } catch (error) {
    console.error('Fetch residents error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch residents.' },
      { status: 500 },
    );
  }
}
