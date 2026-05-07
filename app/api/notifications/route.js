import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

function parseBool(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

function replaceRejectWords(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\bRejected\b/gi, 'Incomplete')
    .replace(/\bReject\b/gi, 'Incomplete')
    .replace(/\bRejection\b/gi, 'Incomplete');
}

export async function GET(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin;
    if (!db) {
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
    const unreadOnly = parseBool(searchParams.get('unreadOnly'));
    const countOnly = parseBool(searchParams.get('countOnly'));
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 30), 1), 100);

    const isMissingNotificationsTable = (err) => {
      const msg = String(err?.message || '').toLowerCase();
      const code = String(err?.code || '').toLowerCase();
      return (
        msg.includes("public.notifications") ||
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        code === '42p01'
      );
    };

    if (countOnly) {
      try {
        let q = db
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', auth.authUser.id);
        if (unreadOnly) q = q.eq('is_read', false);

        const { count, error } = await q;
        if (error) throw error;

        return NextResponse.json({ data: count || 0, error: null });
      } catch (err) {
        if (!isMissingNotificationsTable(err)) throw err;
        return NextResponse.json({ data: 0, error: null, meta: { notificationsSupported: false } });
      }
    }

    try {
      let query = db
        .from('notifications')
        .select('id, title, message, type, is_read, link, created_at')
        .eq('user_id', auth.authUser.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) query = query.eq('is_read', false);

      const { data, error } = await query;
      if (error) throw error;

      const sanitized = (data || []).map((n) => ({
        ...n,
        title: replaceRejectWords(n.title),
        message: replaceRejectWords(n.message),
      }));

      return NextResponse.json({ data: sanitized, error: null });
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase();
      const code = String(err?.code || '').toLowerCase();
      const isMissing =
        msg.includes("public.notifications") ||
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        code === '42p01';

      if (!isMissing) throw err;
      return NextResponse.json({ data: [], error: null, meta: { notificationsSupported: false } });
    }
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to fetch notifications.' },
      { status: 500 },
    );
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin;
    if (!db) {
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

    const markAll = !!body?.markAll;
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

    let query;
    try {
      query = db.from('notifications').update({ is_read: true }).eq('user_id', auth.authUser.id);
    } catch (err) {
      return NextResponse.json({ data: true, error: null, meta: { notificationsSupported: false } });
    }

    if (markAll) {
      query = query.eq('is_read', false);
    } else {
      if (!ids.length) {
        return NextResponse.json(
          { data: null, error: 'Missing notification ids.' },
          { status: 400 },
        );
      }
      query = query.in('id', ids);
    }

    const { error } = await query;
    if (error) {
      const msg = String(error?.message || '').toLowerCase();
      const code = String(error?.code || '').toLowerCase();
      const isMissing =
        msg.includes("public.notifications") ||
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        code === '42p01';

      if (isMissing) {
        return NextResponse.json({ data: true, error: null, meta: { notificationsSupported: false } });
      }

      throw error;
    }

    return NextResponse.json({ data: true, error: null });
  } catch (error) {
    console.error('Update notifications error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to update notifications.' },
      { status: 500 },
    );
  }
}
