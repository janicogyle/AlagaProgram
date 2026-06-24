import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { loadAccountRequestForResubmission } from '@/lib/accountResubmissionTokens.server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';
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

function safeFolderPart(value) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
}

function isResubmissionSchemaError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return msg.includes('resubmission_token_hash') || (msg.includes('resubmission') && msg.includes('schema cache'));
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const token = form.get('token');
    const file = form.get('file');
    const documentType = String(form.get('documentType') || form.get('document_type') || 'validId').trim();

    const lookup = await loadAccountRequestForResubmission(supabaseAdmin, token);
    if (!lookup.ok) {
      return NextResponse.json({ data: null, error: lookup.error }, { status: lookup.status });
    }

    const folderKey = safeFolderPart(lookup.request.contact_number) || safeFolderPart(lookup.request.id);
    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/account-requests/${folderKey}/resubmissions/${DOCUMENT_FOLDERS[documentType] || DOCUMENT_FOLDERS.validId}`,
      imageOnly: IMAGE_ONLY_TYPES.has(documentType),
    });

    if (!upload.ok) {
      return NextResponse.json(
        { data: null, error: upload.error },
        { status: upload.error?.includes('configuration') ? 500 : 400 },
      );
    }

    await logActivity(
      {
        actor_name: lookup.request.contact_number || 'Beneficiary',
        actor_role: 'Beneficiary',
        action: 'Uploaded account request identity document',
        message: `Beneficiary uploaded ${DOCUMENT_LABELS[documentType] || 'identity document'} for resubmission.`,
        entity_type: 'account_request',
        entity_id: lookup.request.id,
        reference_number: lookup.request.contact_number || lookup.request.id,
        link: '/admin/account-requests',
      },
      supabaseAdmin,
    );

    return NextResponse.json({ data: { path: upload.path, url: upload.url }, error: null });
  } catch (error) {
    console.error('Account request resubmission valid ID upload error:', error);
    return NextResponse.json(
      {
        data: null,
        error: isResubmissionSchemaError(error)
          ? 'Account request resubmission is not configured yet. Please contact the barangay office.'
          : error?.message || 'Valid ID upload failed.',
      },
      { status: 500 },
    );
  }
}
