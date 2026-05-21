import { NextResponse } from 'next/server';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { isCloudinaryUrl, isStoredDocumentUrl } from '@/lib/cloudinary.server';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const shouldRedirect = searchParams.get('redirect') === '1';

    if (!path) {
      return NextResponse.json({ data: null, error: 'Missing document path.' }, { status: 400 });
    }

    const stored = String(path).trim();

    if (!isStoredDocumentUrl(stored) || !isCloudinaryUrl(stored)) {
      return NextResponse.json(
        {
          data: null,
          error:
            'Document not available. Files must be stored in Cloudinary. Re-upload if this record used legacy Supabase Storage.',
        },
        { status: 404 },
      );
    }

    if (shouldRedirect) return NextResponse.redirect(stored);
    return NextResponse.json({ data: { url: stored }, error: null });
  } catch (error) {
    console.error('Documents view error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to open document.' },
      { status: 500 },
    );
  }
}
