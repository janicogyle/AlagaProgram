import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['Pending', 'Resubmitted', 'Approved', 'Released', 'Rejected']);

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

    // Always record who performed the action (don’t trust client input)
    update.processed_by = actorName;

    // Ensure updated_at changes even on DBs without an updated_at trigger
    update.updated_at = new Date().toISOString();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ data: null, error: 'No fields to update.' }, { status: 400 });
    }

    let query = db.from('assistance_requests').update(update);
    query = isUuid ? query.eq('id', String(id)) : query.eq('control_number', String(id));

    const { data, error } = await query
      .select(
        'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, processed_by, decision_remarks, valid_id_url, created_at',
      )
      .single();

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
