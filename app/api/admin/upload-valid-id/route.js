import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';

export const runtime = 'nodejs';

async function ensureDocumentsBucket() {
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
  if (error) throw error;

  const exists = Array.isArray(buckets) && buckets.some((b) => b?.name === 'document');
  if (exists) return;

  const { error: createError } = await supabaseAdmin.storage.createBucket('document', {
    public: false,
  });
  if (createError) throw createError;
}

function safeFileName(name) {
  return String(name || 'valid-id')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-120);
}

export async function POST(request) {
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

    const form = await request.formData();
    const file = form.get('file');
    const controlNumberRaw = form.get('controlNumber') || form.get('control_number');
    const controlNumber = String(controlNumberRaw || '').trim() || 'admin-upload';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ data: null, error: 'Missing file.' }, { status: 400 });
    }

    const contentType = String(file.type || 'application/octet-stream');
    const allowed =
      /^image\/(png|jpe?g)$/i.test(contentType) || /^application\/pdf$/i.test(contentType);
    if (!allowed) {
      return NextResponse.json(
        { data: null, error: 'Invalid file type. Allowed: PDF, JPG, JPEG, PNG.' },
        { status: 400 },
      );
    }

    await ensureDocumentsBucket();

    const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const objectPath = `assistance-requests/${controlNumber}/${rand}-${safeFileName(file.name)}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from('document')
      .upload(objectPath, bytes, { upsert: true, contentType });

    if (uploadError) {
      return NextResponse.json(
        { data: null, error: uploadError.message || 'ATTACH REQUIREMENTS upload failed.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: { path: objectPath }, error: null });
  } catch (error) {
    console.error('Admin valid ID upload error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'ATTACH REQUIREMENTS upload failed.' },
      { status: 500 },
    );
  }
}
