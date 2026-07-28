import { NextResponse } from 'next/server';
import { verifyIdentityWithOcr } from '@/lib/identityOcr.server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const form = await request.formData();
    const result = await verifyIdentityWithOcr({
      primaryFile: form.get('primaryId'),
      reverseFile: form.get('reverseId') || null,
      profile: {
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        birthDate: form.get('birthDate'),
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        { data: result, error: result.message },
        { status: result.code === 'SECOND_SIDE_REQUIRED' ? 422 : 400 },
      );
    }
    return NextResponse.json({ data: result.data, error: null });
  } catch (error) {
    console.error('Identity OCR verification error:', {
      code: error?.code || 'OCR_ERROR',
      message: error?.message || 'Identity OCR failed.',
    });
    return NextResponse.json(
      { data: { code: error?.code || 'OCR_ERROR' }, error: error?.message || 'Identity OCR failed.' },
      { status: Number(error?.status) || 500 },
    );
  }
}
