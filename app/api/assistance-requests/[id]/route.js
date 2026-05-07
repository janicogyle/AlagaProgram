import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['Pending', 'Resubmitted', 'Approved', 'Released', 'Rejected']);

const isCheckedRequirement = (row) => {
  if (row === true || row === 'true' || row === 1 || row === '1') return true;
  const value = row?.checked;
  const completed = row?.completed;
  return (
    value === true ||
    value === 'true' ||
    value === 1 ||
    value === '1' ||
    completed === true ||
    completed === 'true' ||
    completed === 1 ||
    completed === '1'
  );
};

const parseChecklist = (value) => {
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

function stripMissingAssistanceColumn(message, payload) {
  const msg = String(message || '');

  let match = msg.match(
    /Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i,
  );

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

function getMissingAssistanceColumn(message) {
  const msg = String(message || '');

  let match = msg.match(
    /Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i,
  );

  if (!match) {
    match = msg.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  }

  if (!match) {
    match = msg.match(
      /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?assistance_requests"\s+does\s+not\s+exist/i,
    );
  }

  return match?.[1] || null;
}

export async function PATCH(request, { params }) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    const actorRole = auth?.profile?.role || 'Staff';

    const formatActorName = (profile, user) => {
      const full = String(profile?.full_name || '').trim();
      if (full) return full;

      const email = String(profile?.email || user?.email || '').trim();
      if (email && email.includes('@')) return email.split('@')[0];

      return email || 'Staff';
    };

    const actorName = formatActorName(auth?.profile, auth?.authUser);

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const paramId = params?.id;
    const bodyKey = body?.control_number || body?.controlNo || body?.request_id || body?.id;
    const id =
      paramId && paramId !== 'undefined' && paramId !== 'null'
        ? paramId
        : bodyKey;

    if (!id || id === 'undefined' || id === 'null') {
      return NextResponse.json({ data: null, error: 'Missing request id.' }, { status: 400 });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

    const status = body.status;
    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json(
        { data: null, error: `Invalid status. Allowed: ${Array.from(ALLOWED_STATUSES).join(', ')}` },
        { status: 400 },
      );
    }

    const update = {};
    if (status) update.status = status;
    if ('decision_remarks' in body) update.decision_remarks = body.decision_remarks || null;

    const requirementsChecklist = parseChecklist(body.requirements_checklist ?? body.requirementsChecklist);
    if (requirementsChecklist !== undefined) {
      update.requirements_checklist = requirementsChecklist;
      update.requirements_completed = requirementsChecklist.length > 0
        ? requirementsChecklist.every(isCheckedRequirement)
        : false;
    } else if ('requirements_completed' in body || 'requirementsCompleted' in body) {
      update.requirements_completed = body.requirements_completed === true || body.requirementsCompleted === true;
    }

    // Always record who performed the action (don’t trust client input)
    update.processed_by = actorName;

    // Ensure updated_at changes even on DBs without an updated_at trigger
    update.updated_at = new Date().toISOString();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ data: null, error: 'No fields to update.' }, { status: 400 });
    }

    let updatePayload = { ...update };
    let selectCols =
      'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, request_source, processed_by, decision_remarks, valid_id_url, requirements_urls, requirements_files, requirements_checklist, requirements_completed, created_at'
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    let data = null;
    let error = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      let query = db.from('assistance_requests').update(updatePayload);
      query = isUuid ? query.eq('id', String(id)) : query.eq('control_number', String(id));
      ({ data, error } = await query.select(selectCols.join(', ')).single());

      if (!error) break;

      const missingInSelect = getMissingAssistanceColumn(error.message);
      if (missingInSelect && selectCols.includes(missingInSelect)) {
        selectCols = selectCols.filter((c) => c !== missingInSelect);
      }

      const stripped = stripMissingAssistanceColumn(error.message, updatePayload);
      if (stripped.removed) {
        updatePayload = stripped.payload;
        selectCols = selectCols.filter((c) => c !== stripped.removed);
      } else if (!missingInSelect) {
        break;
      }
    }

    if (error) throw error;

    // Best-effort notifications:
    // - Actor gets their own "My Activity" entry
    // - Admins get monitoring entries for STAFF actions (not broadcast to other staff)
    if (db) {
      try {
        const statusLabel = data?.status ? String(data.status) : 'Updated';
        const displayStatus = statusLabel === 'Rejected' ? 'Incomplete' : statusLabel;
        const type =
          displayStatus === 'Approved' || displayStatus === 'Released'
            ? 'success'
            : displayStatus === 'Incomplete'
              ? 'error'
              : 'info';

        // 1) Actor notification (personal)
        const actorRow = {
          user_id: auth.authUser.id,
          title: `Assistance request ${displayStatus}`,
          message: `Reference: ${data.control_number}`,
          type,
          link: '/admin/assistance/requests',
        };

        const rows = [actorRow];

        // 2) Admin monitoring notifications only when a STAFF member processed it
        if (actorRole === 'Staff') {
          const { data: admins } = await db
            .from('users')
            .select('id')
            .eq('role', 'Admin')
            .eq('status', 'Active');

          if (admins?.length) {
            rows.push(
              ...admins.map((u) => ({
                user_id: u.id,
                title: `Assistance request ${displayStatus}`,
                message: `Reference: ${data.control_number} • By: ${actorName}`,
                type,
                link: '/admin/assistance/requests',
              })),
            );
          }
        }

        await db.from('notifications').insert(rows);
      } catch (notifyError) {
        console.warn('Unable to create notifications for assistance update:', notifyError);
      }
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Update assistance request error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to update assistance request.' },
      { status: 500 },
    );
  }
}
