import { NextResponse } from 'next/server';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { isCloudinaryUrl } from '@/lib/cloudinary.server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;

export async function GET(request) {
  const session = readBeneficiarySession(request);
  if (!session.ok) {
    return NextResponse.json({ data: null, error: session.error || 'Unauthorized.' }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { data: null, error: 'Server configuration error. Database admin client not available.' },
      { status: 500 },
    );
  }

  try {
    const { data: resident, error } = await supabaseAdmin
      .from('residents')
      .select('profile_photo_url')
      .eq('id', session.residentId)
      .maybeSingle();

    if (error) throw error;

    const photoUrl = String(resident?.profile_photo_url || '').trim();
    if (!photoUrl || !isCloudinaryUrl(photoUrl)) {
      return NextResponse.json({ data: null, error: 'No beneficiary photo is available.' }, { status: 404 });
    }

    const photoResponse = await fetch(photoUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!photoResponse.ok) {
      throw new Error(`Cloudinary returned HTTP ${photoResponse.status}.`);
    }

    const contentType = photoResponse.headers.get('content-type') || '';
    if (!/^image\/(jpeg|png|webp)$/i.test(contentType)) {
      throw new Error('Stored beneficiary photo is not a supported image.');
    }

    const photo = await photoResponse.arrayBuffer();
    if (!photo.byteLength || photo.byteLength > MAX_PROFILE_PHOTO_BYTES) {
      throw new Error('Stored beneficiary photo has an invalid size.');
    }

    return new NextResponse(photo, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(photo.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Fetch beneficiary profile photo error:', error);
    return NextResponse.json(
      { data: null, error: 'Unable to load the beneficiary photo.' },
      { status: 502 },
    );
  }
}
