import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
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
    const path = searchParams.get('path');
    const shouldRedirect = searchParams.get('redirect') === '1';

    if (!path) {
      return NextResponse.json({ data: null, error: 'Missing document path.' }, { status: 400 });
    }

    // If a full URL is stored (legacy), return/open it only for Staff/Admin.
    if (/^https?:\/\//i.test(path)) {
      if (shouldRedirect) return NextResponse.redirect(path);
      return NextResponse.json({ data: { url: path }, error: null });
    }

    // Support both bucket names: "document" (current) and "documents" (legacy).
    const bucketsToTry = ['document', 'documents'];
    let lastError = null;

    for (const bucket of bucketsToTry) {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 10); // 10 minutes

      if (!error && data?.signedUrl) {
        if (shouldRedirect) return NextResponse.redirect(data.signedUrl);
        return NextResponse.json({ data: { url: data.signedUrl }, error: null });
      }

      lastError = error;
      const msg = String(error?.message || '').toLowerCase();
      const bucketMissing = msg.includes('bucket') && msg.includes('not');
      if (!bucketMissing) break;
    }

    return NextResponse.json(
      { data: null, error: lastError?.message || 'Unable to generate signed URL.' },
      { status: 500 },
    );
  } catch (error) {
    console.error('Documents view error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to open document.' },
      { status: 500 },
    );
  }
}
