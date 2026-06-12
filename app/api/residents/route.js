import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { computeBeneficiaryIdStatus } from '@/lib/beneficiaryIdStatus.server';

export const runtime = 'nodejs';

function jsonSuccess(data, { status = 200, meta } = {}) {
  return NextResponse.json(
    {
      ok: true,
      data,
      error: null,
      meta,
    },
    { status },
  );
}

function jsonError(message, { status = 500, code = 'INTERNAL_ERROR', meta } = {}) {
  return NextResponse.json(
    {
      ok: false,
      data: null,
      error: String(message || 'An unexpected error occurred.'),
      code,
      meta,
    },
    { status },
  );
}

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

  const idStatus = computeBeneficiaryIdStatus({ card, residentStatus });
  if (idStatus === 'Active') return 'Valid';
  return idStatus;
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

function toPostgrestList(values) {
  return `(${values
    .map((value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(',')})`;
}

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

async function loadApprovedSignupContacts(db) {
  try {
    const { data, error } = await db
      .from('account_requests')
      .select('contact_number')
      .eq('status', 'Approved');

    if (error) throw error;

    return uniqueNonEmpty(
      (data || []).flatMap((row) => {
        const raw = String(row?.contact_number || '').trim();
        const normalized = normalizeContactNumber(raw);
        return [raw, normalized];
      }),
    );
  } catch (err) {
    const msg = String(err?.message || err || '').toLowerCase();
    const missing =
      msg.includes('account_requests') &&
      (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'));
    if (!missing) {
      console.warn('Fetch account_requests for registration type failed (continuing):', err?.message || err);
    }
    return [];
  }
}

async function loadLatestQrCards(db) {
  const { data, error } = await db
    .from('beneficiary_cards')
    .select('id, resident_id, issued_at, expires_at, revoked_at, status')
    .order('issued_at', { ascending: false });

  if (error) throw error;

  const cardMap = new Map();
  for (const card of data || []) {
    if (!card?.resident_id || cardMap.has(card.resident_id)) continue;
    cardMap.set(card.resident_id, card);
  }
  return cardMap;
}

async function resolveQrResidentFilter(db, qrValidity) {
  const filter = String(qrValidity || '').trim();
  if (!filter) return { mode: 'none', ids: [] };

  try {
    const latestCards = await loadLatestQrCards(db);
    const withCardIds = Array.from(latestCards.keys());

    if (filter === 'No QR') {
      return { mode: 'excludeIds', ids: withCardIds };
    }

    const ids = [];
    for (const [residentId, card] of latestCards.entries()) {
      const status = computeQrValidity({ residentStatus: '', card });
      if (status === filter) ids.push(residentId);
    }
    return { mode: 'includeIds', ids };
  } catch (err) {
    if (isMissingBeneficiaryCardsTable(err)) {
      return filter === 'No QR'
        ? { mode: 'none', ids: [] }
        : { mode: 'includeIds', ids: [] };
    }
    console.warn('Resolve QR filter failed (continuing):', err?.message || err);
    return filter === 'No QR'
      ? { mode: 'none', ids: [] }
      : { mode: 'includeIds', ids: [] };
  }
}

function applyResidentFilters(query, { search, sector, registrationType, approvedSignupContacts, qrResidentFilter }) {
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

  if (registrationType === 'Online') {
    const contactList = approvedSignupContacts?.length
      ? `,contact_number.in.${toPostgrestList(approvedSignupContacts)}`
      : '';
    nextQuery = nextQuery.or(`account_request_id.not.is.null${contactList}`);
  }

  if (registrationType === 'Walk-In') {
    nextQuery = nextQuery.is('account_request_id', null);
    if (approvedSignupContacts?.length) {
      nextQuery = nextQuery.not('contact_number', 'in', toPostgrestList(approvedSignupContacts));
    }
  }

  if (qrResidentFilter?.mode === 'includeIds') {
    if (!qrResidentFilter.ids.length) return null;
    nextQuery = nextQuery.in('id', qrResidentFilter.ids);
  }

  if (qrResidentFilter?.mode === 'excludeIds' && qrResidentFilter.ids.length) {
    nextQuery = nextQuery.not('id', 'in', toPostgrestList(qrResidentFilter.ids));
  }

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
      return jsonError('Server configuration error. Database client not available.', {
        status: 500,
        code: 'DATABASE_CLIENT_UNAVAILABLE',
      });
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
    const registrationType = searchParams.get('registrationType') || '';
    const qrValidity = searchParams.get('qrValidity') || '';
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
    let residentsData = [];
    const approvedSignupContactValues = await loadApprovedSignupContacts(db);
    const qrResidentFilter = await resolveQrResidentFilter(db, qrValidity);

    for (let attempt = 0; attempt < columns.length; attempt++) {
      let query = db
        .from('residents')
        .select(cols.join(', '), hasPagination ? { count: 'exact' } : undefined);

      query = applyResidentFilters(query, {
        search,
        sector,
        registrationType,
        approvedSignupContacts: approvedSignupContactValues,
        qrResidentFilter,
      });
      if (!query) {
        residentsCount = 0;
        break;
      }
      if (qrValidity === 'Valid') query = query.eq('status', 'Active');
      query = applyResidentSort(query, sortBy);
      if (hasPagination) query = query.range(from, to);

      const { data, error, count } = await query;

      if (!error) {
        const residents = Array.isArray(data) ? data : [];
        lastError = null;
        residentsCount = typeof count === 'number' ? count : residents.length;
        residentsData = residents;
        break;
      }

      lastError = error;
      const missing = getMissingResidentsColumn(error.message);
      if (!missing) break;

      if (required.has(missing)) {
        return jsonError(
          `Database is missing residents.${missing} (or schema cache is stale). Run the latest SQL schema and reload PostgREST:\n\n` +
            `NOTIFY pgrst, 'reload schema';`,
          {
            status: 500,
            code: 'RESIDENTS_COLUMN_MISSING',
            meta: { column: missing },
          },
        );
      }

      const idx = cols.indexOf(missing);
      if (idx === -1) break;
      cols.splice(idx, 1);
    }

    if (lastError) throw lastError;

    const residents = residentsData || [];

    if (residents.length === 0) {
      return jsonSuccess(residents, {
        meta: hasPagination
          ? { page, pageSize, total: residentsCount || 0, totalPages: 0 }
          : undefined,
      });
    }

    const approvedSignupContacts = new Set(
      approvedSignupContactValues.map((contact) => normalizeContactNumber(contact)).filter(Boolean),
    );

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

    return jsonSuccess(enriched, {
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
    return jsonError(error?.message || 'Failed to fetch residents.', {
      status: 500,
      code: error?.code || 'FETCH_RESIDENTS_FAILED',
    });
  }
}
