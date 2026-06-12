import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { uploadDocumentFile } from '@/lib/uploadDocument.server';
import {
  computeBeneficiaryIdStatus,
  computeBeneficiaryRenewalEligibility,
} from '@/lib/beneficiaryIdStatus.server';
import { logBeneficiaryActivity } from '@/lib/activityLogger.server';

export const runtime = 'nodejs';

async function loadLatestCard(residentId) {
  const { data, error } = await supabaseAdmin
    .from('beneficiary_cards')
    .select('id, resident_id, issued_at, expires_at, revoked_at, status')
    .eq('resident_id', residentId)
    .is('revoked_at', null)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadLatestRenewal(residentId) {
  const { data, error } = await supabaseAdmin
    .from('beneficiary_id_renewal_requests')
    .select('id, resident_id, card_id, current_expires_at, updated_valid_id_url, remarks, status, admin_remarks, processed_by, processed_at, created_at, updated_at')
    .eq('resident_id', residentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadResident(residentId) {
  const { data, error } = await supabaseAdmin
    .from('residents')
    .select('id, first_name, middle_name, last_name, contact_number, status')
    .eq('id', residentId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ data: null, error: 'Server configuration error. Database admin client not available.' }, { status: 500 });
    }

    const session = readBeneficiarySession(request);
    if (!session.ok) return NextResponse.json({ data: null, error: session.error || 'Unauthorized.' }, { status: 401 });

    const [resident, card, latestRequest] = await Promise.all([
      loadResident(session.residentId),
      loadLatestCard(session.residentId),
      loadLatestRenewal(session.residentId),
    ]);

    const idStatus = computeBeneficiaryIdStatus({ card, residentStatus: resident?.status });
    const { canRenew, daysUntilExpiration, renewalWindowDays } = computeBeneficiaryRenewalEligibility({
      card,
      idStatus,
      residentStatus: resident?.status,
      latestRequest,
    });
    return NextResponse.json({
      data: {
        latestRequest,
        idStatus,
        canRenew,
        daysUntilExpiration,
        renewalWindowDays,
      },
      error: null,
    });
  } catch (error) {
    console.error('Fetch beneficiary ID renewal error:', error);
    return NextResponse.json({ data: null, error: error?.message || 'Failed to load renewal request.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ data: null, error: 'Server configuration error. Database admin client not available.' }, { status: 500 });
    }

    const session = readBeneficiarySession(request);
    if (!session.ok) return NextResponse.json({ data: null, error: session.error || 'Unauthorized.' }, { status: 401 });

    const residentId = session.residentId;
    const form = await request.formData();
    const file = form.get('validId') || form.get('file');
    const remarks = String(form.get('remarks') || '').trim() || null;

    const [resident, card, latestRequest] = await Promise.all([
      loadResident(residentId),
      loadLatestCard(residentId),
      loadLatestRenewal(residentId),
    ]);

    if (!resident) return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
    if (!card) return NextResponse.json({ data: null, error: 'No Beneficiary ID card found.' }, { status: 404 });
    if (latestRequest?.status === 'Pending') {
      return NextResponse.json({ data: null, error: 'You already have a renewal request under review.' }, { status: 409 });
    }

    const idStatus = computeBeneficiaryIdStatus({ card, residentStatus: resident.status });
    const { canRenew } = computeBeneficiaryRenewalEligibility({
      card,
      idStatus,
      residentStatus: resident.status,
      latestRequest,
    });
    if (!canRenew) {
      return NextResponse.json({ data: null, error: 'Your Beneficiary ID is not yet eligible for renewal.' }, { status: 400 });
    }

    const upload = await uploadDocumentFile({
      file,
      folder: `alaga/beneficiary-id-renewals/${residentId}`,
    });

    if (!upload.ok) {
      return NextResponse.json({ data: null, error: upload.error }, { status: upload.error?.includes('configuration') ? 500 : 400 });
    }

    const payload = {
      resident_id: residentId,
      card_id: card.id,
      current_expires_at: card.expires_at,
      updated_valid_id_url: upload.path,
      remarks,
      status: 'Pending',
      admin_remarks: null,
      processed_by: null,
      processed_at: null,
    };

    let saved;
    if (latestRequest?.status === 'Incomplete') {
      const { data, error } = await supabaseAdmin
        .from('beneficiary_id_renewal_requests')
        .update(payload)
        .eq('id', latestRequest.id)
        .select('id, resident_id, card_id, current_expires_at, updated_valid_id_url, remarks, status, admin_remarks, processed_by, processed_at, created_at, updated_at')
        .single();
      if (error) throw error;
      saved = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from('beneficiary_id_renewal_requests')
        .insert(payload)
        .select('id, resident_id, card_id, current_expires_at, updated_valid_id_url, remarks, status, admin_remarks, processed_by, processed_at, created_at, updated_at')
        .single();
      if (error) throw error;
      saved = data;
    }

    const { error: residentUpdateError } = await supabaseAdmin
      .from('residents')
      .update({ status: 'Renewal Pending' })
      .eq('id', residentId);
    if (residentUpdateError) throw residentUpdateError;

    await logBeneficiaryActivity(
      resident,
      {
        action: latestRequest?.status === 'Incomplete' ? 'Resubmitted ID renewal request' : 'Submitted ID renewal request',
        message: 'Beneficiary ID renewal request submitted for admin review.',
        entity_type: 'beneficiary_id_renewal_request',
        entity_id: saved?.id || null,
        reference_number: String(saved?.id || '').slice(0, 8).toUpperCase(),
        link: '/beneficiary/profile',
      },
      supabaseAdmin,
    );

    try {
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id, role, status')
        .eq('role', 'Admin')
        .eq('status', 'Active');

      if (admins?.length) {
        await supabaseAdmin.from('notifications').insert(
          admins.map((admin) => ({
            user_id: admin.id,
            title: 'New ID renewal request',
            message: `${resident.first_name || 'Beneficiary'} ${resident.last_name || ''}`.trim() || 'A beneficiary submitted an ID renewal request.',
            type: 'info',
            link: '/admin/renewal-requests',
          })),
        );
      }
    } catch (notifyError) {
      console.warn('Unable to create ID renewal admin notifications:', notifyError?.message || notifyError);
    }

    return NextResponse.json({ data: saved, error: null }, { status: latestRequest?.status === 'Incomplete' ? 200 : 201 });
  } catch (error) {
    console.error('Submit beneficiary ID renewal error:', error);
    return NextResponse.json({ data: null, error: error?.message || 'Failed to submit renewal request.' }, { status: 500 });
  }
}
