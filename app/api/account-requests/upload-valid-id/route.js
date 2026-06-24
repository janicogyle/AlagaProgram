import { NextResponse } from 'next/server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/activityLogger.server';

export const runtime = 'nodejs';

const IMAGE_ONLY_TYPES = new Set(['validIdFront', 'validIdBack', 'selfie']);

const DOCUMENT_FOLDERS = {
  validIdFront: 'front-id',
  validIdBack: 'back-id',
  selfie: 'selfie',
  representativeValidId: 'representative',
  validId: 'valid-id',
};

const DOCUMENT_LABELS = {
  validIdFront: 'front valid ID',
  validIdBack: 'back valid ID',
  selfie: 'selfie',
  representativeValidId: 'representative valid ID',
  validId: 'valid ID',
};

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
    const documentType = String(form.get('documentType') || form.get('document_type') || 'validId').trim();
    const contactNumber = normalizeContactNumber(contactNumberRaw);

    if (!contactNumber) {
      return NextResponse.json({ data: null, error: 'Missing contact number.' }, { status: 400 });
    }

    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/account-requests/${contactNumber}/${DOCUMENT_FOLDERS[documentType] || DOCUMENT_FOLDERS.validId}`,
      imageOnly: IMAGE_ONLY_TYPES.has(documentType),
    });

    if (!upload.ok) {
      return NextResponse.json({ data: null, error: upload.error }, { status: upload.error?.includes('configuration') ? 500 : 400 });
    }

    await logActivity(
      {
        actor_name: contactNumber,
        actor_role: 'Beneficiary',
        action: 'Uploaded account request identity document',
        message: `Beneficiary uploaded ${DOCUMENT_LABELS[documentType] || 'identity document'}.`,
        entity_type: 'account_request_upload',
        reference_number: contactNumber,
        link: '/admin/account-requests',
      },
      supabaseAdmin,
    );

    return NextResponse.json({ data: { path: upload.path, url: upload.url }, error: null });
  } catch (error) {
    console.error('Account request valid ID upload error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Valid ID upload failed.' },
      { status: 500 },
    );
  }
}
