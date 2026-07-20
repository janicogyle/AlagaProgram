import { NextResponse } from 'next/server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { logActivity } from '@/lib/activityLogger.server';

export const runtime = 'nodejs';

const LOCAL_UPLOAD_BYPASS = process.env.NODE_ENV !== 'production';
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

function safeLocalPart(input) {
  return String(input || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

function localBypassUpload({ contactNumber, documentType, file }) {
  const folder = DOCUMENT_FOLDERS[documentType] || DOCUMENT_FOLDERS.validId;
  const fileName = safeLocalPart(file?.name || `${documentType}.png`);
  const timestamp = Date.now();
  return `https://res.cloudinary.com/local-dev/image/upload/alaga/account-requests/${contactNumber}/${folder}/${timestamp}-${fileName}`;
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

    let upload;
    try {
      upload = await uploadDocumentFile({
        file,
        folder: `alaga/account-requests/${contactNumber}/${DOCUMENT_FOLDERS[documentType] || DOCUMENT_FOLDERS.validId}`,
        imageOnly: IMAGE_ONLY_TYPES.has(documentType),
      });
    } catch (uploadError) {
      upload = {
        ok: false,
        error: uploadError?.message || 'Cloudinary upload failed.',
      };
    }

    if (!upload.ok && LOCAL_UPLOAD_BYPASS) {
      console.warn(
        `[LOCAL UPLOAD BYPASS] Cloudinary upload failed for ${documentType}: ${upload.error}. Using placeholder URL.`,
      );
      const url = localBypassUpload({ contactNumber, documentType, file });
      upload = { ok: true, path: url, url, bypassed: true };
    }

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
