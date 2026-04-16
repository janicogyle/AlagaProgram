import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['Pending', 'Approved', 'Released', 'Rejected']);

export async function PATCH(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

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
    if ('processed_by' in body) update.processed_by = body.processed_by || null;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ data: null, error: 'No fields to update.' }, { status: 400 });
    }

    let query = db.from('assistance_requests').update(update);
    query = isUuid ? query.eq('id', String(id)) : query.eq('control_number', String(id));

    const { data, error } = await query.select('*').single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Update assistance request error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to update assistance request.' },
      { status: 500 },
    );
  }
}
