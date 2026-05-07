import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';

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

function mapNotificationToActivity(row) {
  const level = row?.type || 'info';
  const colorByLevel = {
    info: 'blue',
    success: 'green',
    warning: 'orange',
    error: 'red',
  };

  const iconByLevel = {
    info: 'clipboard',
    success: 'check-circle',
    warning: 'file-text',
    error: 'x-circle',
  };

  return {
    id: String(row.id),
    source: 'notification',
    title: replaceRejectWords(row.title),
    message: replaceRejectWords(row.message),
    time: row.created_at,
    read: !!row.is_read,
    icon: iconByLevel[level] || 'clipboard',
    color: colorByLevel[level] || 'blue',
    link: row.link || null,
  };
}

function mapAssistanceToActivity(row, { isBeneficiaryView } = {}) {
  const status = String(row?.status || 'Pending');

  const map = {
    Pending: { icon: 'file-text', color: 'orange', label: 'Pending' },
    Approved: { icon: 'check-circle', color: 'green', label: 'Approved' },
    Released: { icon: 'package', color: 'teal', label: 'Released' },
    Rejected: { icon: 'x-circle', color: 'red', label: 'Incomplete' },
    Incomplete: { icon: 'x-circle', color: 'red', label: 'Incomplete' },
  };

  const meta = map[status] || { icon: 'clipboard', color: 'blue', label: status };
  const control = row?.control_number || row?.id || 'request';

  const title = `Assistance request ${meta.label}`;

  const message = isBeneficiaryView
    ? `Reference: ${control}`
    : `Reference: ${control}${row?.requester_name ? ` • Requester: ${row.requester_name}` : ''}`;

  return {
    id: `assist:${String(control)}`,
    source: isBeneficiaryView ? 'beneficiary' : 'system',
    title,
    message,
    time: row?.created_at || row?.request_date || null,
    read: false,
    icon: meta.icon,
    color: meta.color,
    link: isBeneficiaryView ? '/beneficiary/history' : '/admin/assistance/requests',
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 30), 1), 100);
    const unreadOnly = parseBool(searchParams.get('unreadOnly'));

    // 1) Staff/Admin (Authorization: Bearer <token>)
    const hasAuthHeader = !!request.headers.get('authorization');
    if (hasAuthHeader) {
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

      let rows = [];
      try {
        let q = db
          .from('notifications')
          .select('id, title, message, type, is_read, link, created_at')
          .eq('user_id', auth.authUser.id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (unreadOnly) q = q.eq('is_read', false);

        const res = await q;
        if (res.error) throw res.error;
        rows = res.data || [];
      } catch (err) {
        // If notifications table isn't installed yet, fall back to assistance_requests.
        if (!isMissingNotificationsTable(err)) throw err;
        rows = [];
      }

      const activities = (rows || []).map(mapNotificationToActivity);

      // Fallback so the panel is still useful even before notifications exist.
      if (activities.length === 0 && !unreadOnly) {
        const { data: recent, error: recentError } = await db
          .from('assistance_requests')
          .select('id, control_number, requester_name, status, request_date, created_at')
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 10));

        if (!recentError) {
          return NextResponse.json({ data: (recent || []).map((r) => mapAssistanceToActivity(r)), error: null });
        }
      }

      return NextResponse.json({ data: activities, error: null });
    }

    // 2) Beneficiary (cookie-based session)
    const session = readBeneficiarySession(request);
    if (!session.ok) {
      return NextResponse.json({ data: [], error: 'Unauthorized.' }, { status: 401 });
    }

    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { data: requests, error: reqError } = await db
      .from('assistance_requests')
      .select('id, control_number, status, request_date, created_at')
      .eq('resident_id', session.residentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (reqError) throw reqError;

    const activities = (requests || []).map((r) => mapAssistanceToActivity(r, { isBeneficiaryView: true }));
    return NextResponse.json({ data: activities, error: null });
  } catch (error) {
    console.error('Fetch activity error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to fetch activity.' },
      { status: 500 },
    );
  }
}
