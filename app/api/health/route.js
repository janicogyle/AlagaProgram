import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const DATABASE_CHECK_TIMEOUT_MS = 3_000;

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { status: 'unavailable', database: 'not_configured', checkedAt: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let timeoutId;
  try {
    const databaseCheck = supabaseAdmin
      .from('assistance_budgets')
      .select('assistance_type', { head: true, count: 'exact' })
      .limit(1);
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Database health check timed out.')), DATABASE_CHECK_TIMEOUT_MS);
    });
    const result = await Promise.race([databaseCheck, timeout]);
    if (result?.error) throw result.error;

    return NextResponse.json(
      { status: 'ok', database: 'ok', checkedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable', database: 'error', checkedAt: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
