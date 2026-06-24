import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { validateCloudinaryDocumentUrls } from '@/lib/documentUrls.server';
import { logActivity } from '@/lib/activityLogger.server';
import { loadAccountRequestForResubmission } from '@/lib/accountResubmissionTokens.server';
import { verifyFaceMatch } from '@/lib/faceVerification.server';

export const runtime = 'nodejs';

function clean(value) {
  return String(value || '').trim();
}

async function resolveReference(body) {
  const token = clean(body.token);
  if (!token) {
    return {
      ok: true,
      referenceNumber: clean(body.contactNumber || body.contact_number) || null,
      entityId: null,
      actorName: clean(body.contactNumber || body.contact_number) || 'Beneficiary',
    };
  }

  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: 'Server configuration error. Database admin client not available.' };
  }

  const lookup = await loadAccountRequestForResubmission(supabaseAdmin, token);
  if (!lookup.ok) return lookup;

  return {
    ok: true,
    referenceNumber: lookup.request.contact_number || lookup.request.id,
    entityId: lookup.request.id,
    actorName: lookup.request.contact_number || 'Beneficiary',
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const idImageUrl = clean(body.validIdFrontUrl || body.valid_id_front_url || body.idImageUrl);
    const selfieUrl = clean(body.selfieUrl || body.selfie_url);
    const docCheck = validateCloudinaryDocumentUrls([idImageUrl, selfieUrl], { label: 'Face verification image' });
    if (!docCheck.ok) {
      return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
    }

    const ref = await resolveReference(body);
    if (!ref.ok) {
      return NextResponse.json({ data: null, error: ref.error }, { status: ref.status || 400 });
    }

    const result = await verifyFaceMatch({ idImageUrl, selfieUrl });
    const now = new Date().toISOString();
    const payload = {
      status: result.status,
      score: result.score,
      provider: result.provider,
      verifiedAt: now,
      error: result.error || null,
    };

    await logActivity(
      {
        actor_name: ref.actorName,
        actor_role: 'Beneficiary',
        action:
          result.status === 'passed'
            ? 'Face verification passed'
            : result.status === 'failed'
              ? 'Face verification failed'
              : 'Face verification manual review required',
        message: result.error || `Face verification completed with status: ${result.status}.`,
        entity_type: 'account_request',
        entity_id: ref.entityId,
        reference_number: ref.referenceNumber,
        link: '/admin/account-requests',
      },
      supabaseAdmin,
    );

    return NextResponse.json({ data: payload, error: null });
  } catch (error) {
    console.error('Face verification error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Face verification failed.' },
      { status: 500 },
    );
  }
}
