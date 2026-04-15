import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set(['Pending', 'Approved', 'Released', 'Rejected']);

export async function PATCH(request, { params }) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const id = params?.id;
    if (!id) {
      return NextResponse.json({ data: null, error: 'Missing request id.' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

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

    const { data, error } = await db
      .from('assistance_requests')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

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
