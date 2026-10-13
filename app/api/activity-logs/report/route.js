import { NextResponse } from 'next/server';
import { requireSynchronizedAdmin } from '@/lib/apiAuth';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  logStaffActivity,
  isMissingActivityLogsTable,
} from '@/lib/activityLogger.server';
import {
  fetchActivityLogRows,
  getActivityLogViewerFromStaffAuth,
  parseActivityLogFilters,
} from '@/lib/activityLogs.server';
import { createActivityLogReportPdf } from '@/lib/activityLogPdf.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reportFilename() {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return `alaga-activity-logs-${date}.pdf`;
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    const auth = await requireSynchronizedAdmin(request);
    if (!auth.ok) return auth.response;
    const viewer = getActivityLogViewerFromStaffAuth(auth);

    const { searchParams } = new URL(request.url);
    const filters = parseActivityLogFilters(searchParams);
    const { rows, total } = await fetchActivityLogRows({
      db: supabaseAdmin,
      viewer,
      filters,
      exportLimit: 5000,
    });
    const pdf = await createActivityLogReportPdf({
      rows,
      viewer,
      filters,
      total,
    });

    const activity = {
      action: 'Generated activity log report',
      message: `Generated a PDF activity report containing ${rows.length} record(s).`,
      entity_type: 'activity_log_report',
      reference_number: reportFilename(),
      link: '/admin/activity-logs',
    };
    await logStaffActivity(auth, activity, supabaseAdmin);

    const disposition = searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${reportFilename()}"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
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
    console.error('Generate activity log report error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to generate the activity log report.' },
      { status: 500 },
    );
  }
}
