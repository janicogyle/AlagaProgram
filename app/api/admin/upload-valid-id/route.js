import { NextResponse } from 'next/server';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const file = form.get('file');
    const controlNumberRaw = form.get('controlNumber') || form.get('control_number');
    const controlNumber = String(controlNumberRaw || '').trim() || 'admin-upload';

    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/assistance-requests/${controlNumber}`,
    });

    if (!upload.ok) {
      return NextResponse.json({ data: null, error: upload.error }, { status: upload.error?.includes('configuration') ? 500 : 400 });
    }

    return NextResponse.json({ data: { path: upload.path, url: upload.url }, error: null });
  } catch (error) {
    console.error('Admin valid ID upload error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'ATTACH REQUIREMENTS upload failed.' },
      { status: 500 },
    );
  }
}
