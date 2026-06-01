import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { isMissingActivityLogsTable } from '@/lib/activityLogger.server';

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

function isMissingNotificationsTable(err) {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    msg.includes("public.notifications") ||
    msg.includes('notifications') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    code === '42p01'
  );
}

function iconForAction(action, role) {
  const text = String(action || '').toLowerCase();
  if (text.includes('approved')) return { icon: 'check-circle', color: 'green' };
  if (text.includes('released')) return { icon: 'package', color: 'teal' };
  if (text.includes('incomplete') || text.includes('archived') || text.includes('deleted')) {
    return { icon: 'x-circle', color: 'red' };
  }
  if (text.includes('submitted') || text.includes('resubmitted')) return { icon: 'file-text', color: 'orange' };
  if (text.includes('user') || text.includes('account')) return { icon: 'user-plus', color: 'indigo' };
  if (role === 'Beneficiary') return { icon: 'file-text', color: 'blue' };
  return { icon: 'clipboard', color: 'blue' };
}

function mapActivityLog(row, { viewerRole } = {}) {
  const actor = row?.actor_name ? `${row.actor_name} (${row.actor_role || 'User'})` : row?.actor_role || 'User';
  const reference = row?.reference_number ? `Reference: ${row.reference_number}` : '';
  const messageParts = [row?.message, reference, actor ? `By: ${actor}` : ''].filter(Boolean);
  const meta = iconForAction(row?.action, row?.actor_role);

  return {
    id: `activity:${String(row.id)}`,
    source: 'activity_log',
    title: replaceRejectWords(row?.action || 'Activity'),
    message: replaceRejectWords(messageParts.join(' • ')),
    time: row?.created_at,
    read: false,
    icon: meta.icon,
    color: meta.color,
    link:
      viewerRole === 'Beneficiary' && row?.entity_type === 'assistance_request'
        ? '/beneficiary/history'
        : viewerRole === 'Beneficiary' && row?.entity_type === 'account_request'
          ? '/beneficiary/profile'
          : row?.link || null,
  };
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

async function loadStaffOrAdminActivity(db, auth, { limit, unreadOnly }) {
  try {
    let query = db
      .from('activity_logs')
      .select(
        'id, actor_user_id, actor_resident_id, actor_name, actor_role, action, message, entity_type, entity_id, reference_number, link, audience_user_id, audience_resident_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (auth.profile.role !== 'Admin') {
      query = query.or(`actor_user_id.eq.${auth.authUser.id},audience_user_id.eq.${auth.authUser.id}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    if (unreadOnly) return [];
    return rows.map((row) => mapActivityLog(row, { viewerRole: auth.profile.role }));
  } catch (err) {
    if (!isMissingActivityLogsTable(err)) throw err;
    return null;
  }
}

async function loadBeneficiaryActivity(db, residentId, { limit, unreadOnly }) {
  try {
    const { data, error } = await db
      .from('activity_logs')
      .select(
        'id, actor_user_id, actor_resident_id, actor_name, actor_role, action, message, entity_type, entity_id, reference_number, link, audience_user_id, audience_resident_id, created_at',
      )
      .or(`actor_resident_id.eq.${residentId},audience_resident_id.eq.${residentId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (unreadOnly) return [];
    return (data || []).map((row) => mapActivityLog(row, { viewerRole: 'Beneficiary' }));
  } catch (err) {
    if (!isMissingActivityLogsTable(err)) throw err;
    return null;
  }
}

async function loadNotificationFallback(db, auth, { limit, unreadOnly }) {
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
    if (!isMissingNotificationsTable(err)) throw err;
    rows = [];
  }

  return rows.map(mapNotificationToActivity);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 30), 1), 100);
    const unreadOnly = parseBool(searchParams.get('unreadOnly'));

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

      const activityLogs = await loadStaffOrAdminActivity(db, auth, { limit, unreadOnly });
      if (activityLogs) return NextResponse.json({ data: activityLogs, error: null });

      const activities = await loadNotificationFallback(db, auth, { limit, unreadOnly });

      if (activities.length === 0 && !unreadOnly) {
        let recentQuery = db
          .from('assistance_requests')
          .select('id, control_number, requester_name, status, request_date, created_at')
          .order('created_at', { ascending: false })
          .limit(Math.min(limit, 10));

        if (auth.profile.role !== 'Admin') {
          recentQuery = recentQuery.eq('processed_by', auth.profile.full_name || auth.profile.email);
        }

        const { data: recent, error: recentError } = await recentQuery;
        if (!recentError) {
          return NextResponse.json({ data: (recent || []).map((r) => mapAssistanceToActivity(r)), error: null });
        }
      }

      return NextResponse.json({ data: activities, error: null });
    }

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

    const activityLogs = await loadBeneficiaryActivity(db, session.residentId, { limit, unreadOnly });
    if (activityLogs) return NextResponse.json({ data: activityLogs, error: null });

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
