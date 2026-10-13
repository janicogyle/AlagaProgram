import { NextResponse } from 'next/server';
import { requireSynchronizedStaffOrAdmin } from '@/lib/apiAuth';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isMissingActivityLogsTable } from '@/lib/activityLogger.server';
import {
  fetchActivityLogRows,
  getActivityLogViewerFromBeneficiarySession,
  getActivityLogViewerFromStaffAuth,
  parseActivityLogFilters,
} from '@/lib/activityLogs.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveViewer(request) {
  if (request.headers.get('authorization')) {
    const auth = await requireSynchronizedStaffOrAdmin(request);
    if (!auth.ok) return { response: auth.response };
    return { viewer: getActivityLogViewerFromStaffAuth(auth) };
  }

  const session = readBeneficiarySession(request);
  if (!session.ok) {
    return {
      response: NextResponse.json({ data: null, error: 'Unauthorized.' }, { status: 401 }),
    };
  }
  return { viewer: getActivityLogViewerFromBeneficiarySession(session) };
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    const resolved = await resolveViewer(request);
    if (resolved.response) return resolved.response;

    const { searchParams } = new URL(request.url);
    const filters = parseActivityLogFilters(searchParams);
    const { rows, total } = await fetchActivityLogRows({
      db: supabaseAdmin,
      viewer: resolved.viewer,
      filters,
    });

    return NextResponse.json(
      {
        data: rows,
        error: null,
        meta: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: Math.ceil(total / filters.pageSize),
          viewerRole: resolved.viewer.role,
          canViewAll: resolved.viewer.kind === 'admin',
        },
      },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    if (isMissingActivityLogsTable(error)) {
      return NextResponse.json(
        {
          data: null,
          error: 'Activity Logs are not configured. Run setup-step32-activity-logs-system.sql in Supabase.',
        },
        { status: 503 },
      );
    }
    console.error('Fetch activity logs error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to fetch activity logs.' },
      { status: 500 },
    );
  }
}

