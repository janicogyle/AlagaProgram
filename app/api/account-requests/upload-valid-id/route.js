import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

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
    const contactNumberRaw = form.get('contactNumber') || form.get('contact_number');
    const contactNumber = normalizeContactNumber(contactNumberRaw);

    if (!contactNumber) {
      return NextResponse.json({ data: null, error: 'Missing contact number.' }, { status: 400 });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ data: null, error: 'Missing file.' }, { status: 400 });
    }

    const contentType = String(file.type || 'application/octet-stream');
    const allowed = /^image\/(png|jpe?g)$/i.test(contentType) || /^application\/pdf$/i.test(contentType);
    if (!allowed) {
      return NextResponse.json(
        { data: null, error: 'Invalid file type. Allowed: PDF, JPG, JPEG, PNG.' },
        { status: 400 },
      );
    }

    await ensureDocumentsBucket();

    const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    const objectPath = `account-requests/${contactNumber}/${rand}-${safeFileName(file.name)}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabaseAdmin.storage
      .from('document')
      .upload(objectPath, bytes, { upsert: true, contentType });

    if (uploadError) {
      return NextResponse.json(
        { data: null, error: uploadError.message || 'Valid ID upload failed.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: { path: objectPath }, error: null });
  } catch (error) {
    console.error('Account request valid ID upload error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Valid ID upload failed.' },
      { status: 500 },
    );
  }
}
