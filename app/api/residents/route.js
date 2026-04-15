import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const selectWithUpdatedAt =
      'id, control_number, first_name, middle_name, last_name, birthday, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, status, created_at, updated_at';

    const selectWithoutUpdatedAt =
      'id, control_number, first_name, middle_name, last_name, birthday, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, status, created_at';

    const runQuery = async (select) =>
      db.from('residents').select(select).order('created_at', { ascending: false });

    let { data, error } = await runQuery(selectWithUpdatedAt);

    if (error) {
      const msg = String(error.message || '');
      const missingUpdatedAt = msg.includes('updated_at') && (msg.includes('does not exist') || msg.includes('schema cache'));
      if (missingUpdatedAt) {
        ({ data, error } = await runQuery(selectWithoutUpdatedAt));
      }
    }

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Fetch residents error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch residents.' },
      { status: 500 },
    );
  }
}
