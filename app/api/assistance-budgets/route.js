import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function isMissingAssistanceBudgetsTable(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('assistance_budgets') &&
    (msg.includes('schema cache') || msg.includes('does not exist') || msg.includes('could not find the table'))
  );
}

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Server configuration error. Missing SUPABASE_SERVICE_ROLE_KEY (Supabase admin client not available).',
        },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const assistanceType = String(body?.assistanceType || body?.assistance_type || '').trim();
    const ceiling = Number(body?.ceiling);

    if (!assistanceType) {
      return NextResponse.json({ data: null, error: 'assistanceType is required.' }, { status: 400 });
    }

    if (!Number.isFinite(ceiling) || ceiling < 0) {
      return NextResponse.json(
        { data: null, error: 'ceiling must be a valid non-negative number.' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('assistance_budgets')
      .upsert({ assistance_type: assistanceType, ceiling }, { onConflict: 'assistance_type' })
      .select('assistance_type, ceiling')
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error('Update assistance budget error:', err);

    if (isMissingAssistanceBudgetsTable(err)) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Assistance budgets table is not set up yet. Run database-schema.sql (or at least setup-step2.sql) in Supabase SQL Editor, then reload PostgREST: NOTIFY pgrst, \'reload schema\';',
          code: 'ASSISTANCE_BUDGETS_TABLE_MISSING',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { data: null, error: err?.message || 'Failed to update budget ceiling.' },
      { status: 500 },
    );
  }
}
