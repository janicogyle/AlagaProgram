import { NextResponse } from 'next/server';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';

export const runtime = 'nodejs';

function getResidentIdFromRequest(request) {
  const session = readBeneficiarySession(request);
  if (session.ok) return { ok: true, residentId: session.residentId, source: 'cookie' };
  return { ok: false, residentId: null, source: 'none' };
}

export async function POST(request) {
  try {
    const resident = getResidentIdFromRequest(request);
    if (!resident.ok) {
      return NextResponse.json({ data: null, error: 'Unauthorized. Please log in again.' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const controlNumberRaw = form.get('controlNumber') || form.get('control_number');
    const controlNumber = String(controlNumberRaw || '').trim();

    if (!controlNumber) {
      return NextResponse.json({ data: null, error: 'Missing control number.' }, { status: 400 });
    }

    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/assistance-requests/${resident.residentId}/${controlNumber}`,
    });

    if (!upload.ok) {
      return NextResponse.json({ data: null, error: upload.error }, { status: upload.error?.includes('configuration') ? 500 : 400 });
    }

    return NextResponse.json({ data: { path: upload.path, url: upload.url }, error: null });
  } catch (error) {
    console.error('Beneficiary valid ID upload error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'ATTACH REQUIREMENTS upload failed.' },
      { status: 500 },
    );
  }
}
