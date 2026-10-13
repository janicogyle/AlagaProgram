import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const ELIGIBILITY_STATUSES = ['Pending', 'Resubmitted', 'Approved', 'Released', 'Rejected', 'Incomplete'];

function isMissingReleasedAt(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('released_at') && (message.includes('schema cache') || message.includes('does not exist'));
}

export async function GET() {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    let { data, error } = await db
      .from('assistance_requests')
      .select('id, resident_id, assistance_type, status, request_date, released_at, created_at, updated_at')
      .in('status', ELIGIBILITY_STATUSES);

    if (error && isMissingReleasedAt(error)) {
      ({ data, error } = await db
        .from('assistance_requests')
        .select('id, resident_id, assistance_type, status, request_date, created_at, updated_at')
        .in('status', ELIGIBILITY_STATUSES));
    }

    if (error) throw error;

    return NextResponse.json({ data: Array.isArray(data) ? data : [], error: null });
  } catch (error) {
    console.error('Fetch assistance request eligibility error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch assistance request eligibility.' },
      { status: 500 },
    );
  }
}
