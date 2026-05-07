import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function countRows(db, table, buildQuery = (q) => q) {
  const query = buildQuery(db.from(table).select('id', { count: 'exact', head: true }));
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

function isMissingRelation(error) {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        /relation .* does not exist/i.test(error.message || '') ||
        /does not exist/i.test(error.details || '')),
  );
}

function isMissingColumn(error) {
  return Boolean(
    error && (error.code === '42703' || /column .* does not exist/i.test(error.message || '')),
  );
}

export async function GET() {
  const db = getSupabaseClient();
  if (!db) {
    return NextResponse.json(
      { error: 'Server configuration error. Supabase env vars are missing.' },
      { status: 500 },
    );
  }

  // Prefer residents table (source of truth after approvals). Fall back to approved account_requests.
  let baseTable = 'residents';

  const totalResidents = await countRows(db, baseTable);
  if (totalResidents.error && isMissingRelation(totalResidents.error)) {
    baseTable = 'account_requests';
  }

  const statusFilter = (q) => q.eq('status', 'Active');
  const approvedFilter = (q) => q.eq('status', 'Approved');

  const activeScope = baseTable === 'residents' ? statusFilter : approvedFilter;

  // If the table doesn't have a status column, just count by sector flags without status.
  const testStatus = await countRows(db, baseTable, activeScope);
  const sectorScope = testStatus.error && isMissingColumn(testStatus.error) ? (q) => q : activeScope;

  const [total, pwd, senior, solo] = await Promise.all([
    baseTable === 'residents'
      ? totalResidents
      : countRows(db, baseTable, (q) => q.eq('status', 'Approved')),
    countRows(db, baseTable, (q) => sectorScope(q).eq('is_pwd', true)),
    countRows(db, baseTable, (q) => sectorScope(q).eq('is_senior_citizen', true)),
    countRows(db, baseTable, (q) => sectorScope(q).eq('is_solo_parent', true)),
  ]);

  const firstError = total.error || pwd.error || senior.error || solo.error;
  if (firstError) {
    // Avoid leaking internal details; return a generic message.
    return NextResponse.json({ error: 'Failed to load statistics.' }, { status: 500 });
  }

  const payload = {
    totalResidents: total.count,
    pwdCount: pwd.count,
    seniorCount: senior.count,
    soloParentCount: solo.count,
    source: baseTable,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: {
      // Cache aggregates to reduce DB load; safe because payload is non-sensitive.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
