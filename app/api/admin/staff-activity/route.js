import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function parseLimit(value) {
  const n = Number(value || 20);
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(n, 1), 100);
}

function isMissingTableError(err, tableName) {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    msg.includes(tableName.toLowerCase()) ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    code === '42p01'
  );
}

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));

    // Preferred source: notifications written to this admin when staff processes requests.
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('id, title, message, type, link, created_at')
        .eq('user_id', auth.authUser.id)
        .ilike('title', 'Assistance request %')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const items = (data || []).map((n) => ({
        id: String(n.id),
        title: String(n.title || '').replace(/\bRejected\b/gi, 'Incomplete'),
        message: String(n.message || '').replace(/\bRejected\b/gi, 'Incomplete'),
        type: n.type || 'info',
        link: n.link || '/admin/assistance/requests',
        time: n.created_at,
      }));

      return NextResponse.json({ data: items, error: null, meta: { source: 'notifications' } });
    } catch (err) {
      if (!isMissingTableError(err, 'public.notifications')) throw err;
      // fall through
    }

    // Fallback: derive from assistance_requests (works even without notifications table)
    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('assistance_requests')
      .select('id, control_number, status, processed_by, updated_at, created_at')
      .not('processed_by', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (rowsError) throw rowsError;

    const items = (rows || []).map((r) => {
      const status = r.status === 'Rejected' ? 'Incomplete' : r.status || 'Updated';
      const actor = r.processed_by || 'Staff';
      return {
        id: String(r.id),
        title: `Assistance request ${status}`,
        message: `Reference: ${r.control_number} • By: ${actor}`,
        type: status === 'Approved' || status === 'Released' ? 'success' : status === 'Incomplete' ? 'error' : 'info',
        link: '/admin/assistance/requests',
        time: r.updated_at || r.created_at,
      };
    });

    return NextResponse.json({ data: items, error: null, meta: { source: 'assistance_requests' } });
  } catch (error) {
    console.error('Fetch staff activity error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to fetch staff activity.' },
      { status: 500 },
    );
  }
}
