import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getResidentIdFromRequest(request, body) {
  const session = readBeneficiarySession(request);
  if (session.ok) return { ok: true, residentId: session.residentId, source: 'cookie' };

  const residentId =
    body?.resident_id ||
    body?.residentId ||
    request.headers.get('x-resident-id') ||
    request.headers.get('x-residentid');

  if (!residentId) return { ok: false, residentId: null, source: 'none' };
  return { ok: true, residentId: String(residentId), source: 'body' };
}

export async function PATCH(request, { params }) {
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

    const idParam = params?.id;
    const bodyKey = body?.control_number || body?.controlNo || body?.request_id || body?.requestId || body?.id;

    const clean = (v) => {
      const s = String(v ?? '').trim();
      if (!s || s === 'undefined' || s === 'null') return null;
      return s;
    };

    // Prefer URL param, but fall back to body control number if client sent /undefined.
    const id = clean(idParam) || clean(bodyKey);
    if (!id) {
      return NextResponse.json({ data: null, error: 'Missing request id.' }, { status: 400 });
    }

    const resident = getResidentIdFromRequest(request, body);
    if (!resident.ok) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized. Please log in again.' },
        { status: 401 },
      );
    }

    const isUuid = UUID_RE.test(id);
    let lookup = db.from('assistance_requests').select('id, resident_id, status, control_number');
    lookup = isUuid ? lookup.eq('id', id) : lookup.eq('control_number', id);

    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;

    if (!existing) {
      return NextResponse.json({ data: null, error: 'Request not found.' }, { status: 404 });
    }

    if (String(existing.resident_id) !== String(resident.residentId)) {
      return NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 });
    }

    // Stored status is still "Rejected" for compatibility, but user-facing label is "Incomplete".
    if (existing.status !== 'Rejected') {
      return NextResponse.json(
        { data: null, error: 'Only incomplete requests can be edited.' },
        { status: 400 },
      );
    }

    const parseRequirements = (value) => {
      if (value === undefined) return undefined;
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // ignore
        }
      }
      return [];
    };

    const requirementsUrls = parseRequirements(body.requirements_urls ?? body.requirementsUrls);

    const allowed = {
      requester_name: body.requester_name ?? body.requesterName,
      requester_contact: body.requester_contact ?? body.requesterContact,
      requester_address: body.requester_address ?? body.requesterAddress,
      beneficiary_name: body.beneficiary_name ?? body.beneficiaryName,
      beneficiary_contact: body.beneficiary_contact ?? body.beneficiaryContact,
      beneficiary_address: body.beneficiary_address ?? body.beneficiaryAddress,
      assistance_type: body.assistance_type ?? body.assistanceType,
      amount: body.amount,
      request_date: body.request_date ?? body.requestDate,
      // Legacy column: always keep populated
      valid_id_url: body.valid_id_url ?? body.validIdUrl ?? requirementsUrls?.[0] ?? null,
      requirements_urls: requirementsUrls,
    };

    const update = {
      status: 'Resubmitted',
      processed_by: null,
      decision_remarks: null,
      updated_at: new Date().toISOString(),
    };

    for (const [key, val] of Object.entries(allowed)) {
      if (val !== undefined) update[key] = val;
    }

    const selectFields =
      'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, processed_by, decision_remarks, valid_id_url, created_at';

    const runUpdate = async (payload) => {
      let updateQuery = db.from('assistance_requests').update(payload);
      updateQuery = isUuid
        ? updateQuery.eq('id', existing.id)
        : updateQuery.eq('control_number', existing.control_number);
      return await updateQuery.select(selectFields).single();
    };

    let { data: updated, error: updateError } = await runUpdate(update);

    if (updateError) {
      const msg = String(updateError?.message || '').toLowerCase();
      if (msg.includes("could not find the 'requirements_urls'") || msg.includes('requirements_urls')) {
        // Backward compatibility: DB may not have requirements_urls yet.
        const next = { ...update };
        delete next.requirements_urls;
        ;({ data: updated, error: updateError } = await runUpdate(next));
      }
    }

    if (updateError) {
      const msg = String(updateError?.message || '').toLowerCase();
      if (msg.includes('check constraint') || msg.includes('violates') || msg.includes('status')) {
        return NextResponse.json(
          {
            data: null,
            error:
              'Database does not allow the "Resubmitted" status yet. Please run the DB update to add Resubmitted to the assistance_requests.status constraint.',
            code: 'STATUS_CONSTRAINT',
          },
          { status: 409 },
        );
      }
      throw updateError;
    }

    // Best-effort: notify Admin/Staff that a beneficiary resubmitted.
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
            title: 'Assistance request resubmitted',
            message: `Reference: ${existing.control_number}`,
            type: 'info',
            link: '/admin/assistance/requests',
          }));
          await supabaseAdmin.from('notifications').insert(rows);
        }
      } catch (notifyError) {
        console.warn('Unable to create notifications for resubmitted request:', notifyError);
      }
    }

    return NextResponse.json({ data: updated, error: null, meta: { residentSource: resident.source } });
  } catch (err) {
    console.error('Beneficiary update assistance request error:', err);
    return NextResponse.json(
      { data: null, error: err?.message || 'Failed to update assistance request.' },
      { status: 500 },
    );
  }
}
