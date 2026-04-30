import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function stripMissingAssistanceColumn(message, payload) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(
    /Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i,
  );

  // Postgres error surfaced via PostgREST
  if (!match) {
    match = msg.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  }

  if (!match) {
    match = msg.match(
      /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?assistance_requests"\s+does\s+not\s+exist/i,
    );
  }

  if (!match) return { payload, removed: null };

  const col = match[1];
  if (!col || typeof payload !== 'object' || payload == null) return { payload, removed: null };
  if (!(col in payload)) return { payload, removed: null };

  const next = { ...payload };
  delete next[col];
  return { payload: next, removed: col };
}

async function generateNextControlNumber(db) {
  const year = new Date().getFullYear();
  const fallback = `${year}-001`;

  try {
    const { data, error } = await db
      .from('assistance_requests')
      .select('control_number')
      .like('control_number', `${year}-%`)
      .order('control_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const last = String(data?.control_number || '').trim();
    const match = last.match(new RegExp(`^${year}-(\\d{3})$`));
    const nextSeq = match ? Number(match[1]) + 1 : 1;

    if (!Number.isFinite(nextSeq) || nextSeq < 1) return fallback;

    return `${year}-${String(nextSeq).padStart(3, '0')}`;
  } catch (err) {
    console.warn('[assistance-requests] Failed to compute next control number:', err);
    return fallback;
  }
}

export async function GET(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');

    const baseRequestFields = [
      'id',
      'control_number',
      'resident_id',
      'requester_name',
      'requester_contact',
      'requester_address',
      'beneficiary_name',
      'beneficiary_contact',
      'beneficiary_address',
      'assistance_type',
      'amount',
      'status',
      'request_date',
      'processed_by',
      'decision_remarks',
      'valid_id_url',
      'created_at',
    ];

    const requestFields = baseRequestFields.join(',');
    const requestFieldsWithRequirements = [...baseRequestFields, 'requirements_urls'].join(',');

    const residentsJoin =
      'residents:resident_id(id, control_number, first_name, middle_name, last_name, birthday, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, representative_name, representative_contact, is_pwd, is_senior_citizen, is_solo_parent)';

    const runQuery = async (fields) => {
      let query = db
        .from('assistance_requests')
        .select([fields, residentsJoin].join(','))
        .order('request_date', { ascending: false });

      if (residentId) {
        query = query.eq('resident_id', residentId);
      }

      return await query;
    };

    const isMissingRequirementsColumn = (message) => {
      const msg = String(message || '').toLowerCase();
      return (
        msg.includes("could not find the 'requirements_urls'") ||
        msg.includes('assistance_requests.requirements_urls') ||
        (msg.includes('requirements_urls') && msg.includes('does not exist'))
      );
    };

    // Prefer returning requirements_urls when DB supports it; fall back to legacy schema.
    let { data, error } = await runQuery(requestFieldsWithRequirements);
    if (error && isMissingRequirementsColumn(error.message)) {
      ;({ data, error } = await runQuery(requestFields));
    }

    if (error) throw error;

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    console.error('Fetch assistance requests error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch assistance requests.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const residentId = body.resident_id || body.residentId;
    if (!residentId) {
      return NextResponse.json({ data: null, error: 'resident_id is required.' }, { status: 400 });
    }

    const assistanceType = body.assistance_type || body.assistanceType;
    if (!assistanceType) {
      return NextResponse.json({ data: null, error: 'assistance_type is required.' }, { status: 400 });
    }

    const amount = Number(body.amount || 0);
    const requestDate = body.request_date || body.requestDate || new Date().toISOString().split('T')[0];

    const parseRequirements = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // ignore
        }
      }
      return null;
    };

    const requirementsUrls = parseRequirements(body.requirements_urls ?? body.requirementsUrls);
    const legacyValidIdUrl = body.valid_id_url || body.validIdUrl || null;
    const validIdUrl = legacyValidIdUrl || (requirementsUrls?.[0] ?? null);

    const providedControlNumber = body.control_number || body.controlNumber || null;

    const buildPayload = (controlNumber) => ({
      control_number: controlNumber,
      resident_id: residentId,
      requester_name: body.requester_name || body.requesterName || null,
      requester_contact: body.requester_contact || body.requesterContact || null,
      requester_address: body.requester_address || body.requesterAddress || null,
      beneficiary_name: body.beneficiary_name || body.beneficiaryName || null,
      beneficiary_contact: body.beneficiary_contact || body.beneficiaryContact || null,
      beneficiary_address: body.beneficiary_address || body.beneficiaryAddress || null,
      assistance_type: assistanceType,
      amount: Number.isFinite(amount) ? amount : 0,
      status: body.status || 'Pending',
      request_date: requestDate,
      valid_id_url: validIdUrl,
      ...(requirementsUrls ? { requirements_urls: requirementsUrls } : {}),
    });

    const selectFields =
      'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, processed_by, decision_remarks, valid_id_url, created_at';

    let data;
    let error;

    // If the client didn't provide a control number, generate a sequential one (YYYY-###).
    // Retry on unique conflicts (rare, but can happen with concurrent requests).
    for (let attempt = 0; attempt < 5; attempt++) {
      const controlNumber =
        providedControlNumber || (await generateNextControlNumber(db));

      const attemptPayload = buildPayload(controlNumber);

      ({ data, error } = await db
        .from('assistance_requests')
        .insert(attemptPayload)
        .select(selectFields)
        .single());

      if (error) {
        // Backward compatibility: older DBs may not have requirements_urls yet.
        const stripped = stripMissingAssistanceColumn(error.message, attemptPayload);
        if (stripped.removed) {
          ;({ data, error } = await db
            .from('assistance_requests')
            .insert(stripped.payload)
            .select(selectFields)
            .single());
        }
      }

      if (!error) break;

      const msg = String(error?.message || '').toLowerCase();
      const isDuplicate = msg.includes('duplicate') && msg.includes('control_number');

      if (providedControlNumber || !isDuplicate) {
        break;
      }
    }

    if (error) throw error;

    // Best-effort: notify all active Admin/Staff of the new request.
    if (supabaseAdmin) {
      try {
        const { data: recipients } = await supabaseAdmin
          .from('users')
          .select('id, role, status')
          .in('role', ['Admin', 'Staff'])
          .eq('status', 'Active');

        if (recipients?.length) {
          const rows = recipients.map((u) => ({
            user_id: u.id,
            title: 'New assistance request',
            message: `Reference: ${data.control_number}${data.requester_name ? ` • Requester: ${data.requester_name}` : ''}`,
            type: 'info',
            link: '/admin/assistance/requests',
          }));
          await supabaseAdmin.from('notifications').insert(rows);
        }
      } catch (notifyError) {
        console.warn('Unable to create notifications for assistance request:', notifyError);
      }
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    console.error('Create assistance request error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to create assistance request.' },
      { status: 500 },
    );
  }
}
