import { NextResponse } from 'next/server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';

export const runtime = 'nodejs';

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('63')) {
    return `0${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `0${digits}`;
  }

  if (digits.length > 11) {
    return digits.slice(-11);
  }

  return digits;
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const contactNumberRaw = form.get('contactNumber') || form.get('contact_number');
    const contactNumber = normalizeContactNumber(contactNumberRaw);

    if (!contactNumber) {
      return NextResponse.json({ data: null, error: 'Missing contact number.' }, { status: 400 });
    }

    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/account-requests/${contactNumber}`,
    });

    if (!upload.ok) {
      return NextResponse.json({ data: null, error: upload.error }, { status: upload.error?.includes('configuration') ? 500 : 400 });
    }

    return NextResponse.json({ data: { path: upload.path, url: upload.url }, error: null });
  } catch (error) {
    console.error('Account request valid ID upload error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Valid ID upload failed.' },
      { status: 500 },
    );
  }
}
