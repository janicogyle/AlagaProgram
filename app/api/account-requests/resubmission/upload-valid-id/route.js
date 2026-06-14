import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { loadAccountRequestForResubmission } from '@/lib/accountResubmissionTokens.server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';

export const runtime = 'nodejs';

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

    const lookup = await loadAccountRequestForResubmission(supabaseAdmin, token);
    if (!lookup.ok) {
      return NextResponse.json({ data: null, error: lookup.error }, { status: lookup.status });
    }

    const folderKey = safeFolderPart(lookup.request.contact_number) || safeFolderPart(lookup.request.id);
    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/account-requests/${folderKey}/resubmissions`,
    });

    if (!upload.ok) {
      return NextResponse.json(
        { data: null, error: upload.error },
        { status: upload.error?.includes('configuration') ? 500 : 400 },
      );
    }

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
