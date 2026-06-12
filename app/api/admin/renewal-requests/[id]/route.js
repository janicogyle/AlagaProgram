import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdmin } from '@/lib/apiAuth';
import { logActivity, logStaffActivity } from '@/lib/activityLogger.server';
import { computeRenewedExpiration } from '@/lib/beneficiaryIdStatus.server';
import {
  sendBeneficiaryIdRenewalApprovedSms,
  sendBeneficiaryIdRenewalIncompleteSms,
} from '@/lib/smsNotify.server';

export const runtime = 'nodejs';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
}

function staffName(auth) {
  return auth?.profile?.full_name || auth?.profile?.email || 'Admin';
}

export async function PATCH(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    if (!supabaseAdmin) {
      return NextResponse.json({ data: null, error: 'Server configuration error. Database admin client not available.' }, { status: 500 });
    }

    const { id } = await params;
    if (!id) return NextResponse.json({ data: null, error: 'Request ID is required.' }, { status: 400 });

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const action = String(body?.action || '').trim().toLowerCase();
    if (!['approve', 'incomplete'].includes(action)) {
      return NextResponse.json({ data: null, error: 'Action must be approve or incomplete.' }, { status: 400 });
    }

    const { data: renewal, error: renewalError } = await supabaseAdmin
      .from('beneficiary_id_renewal_requests')
      .select('id, resident_id, card_id, current_expires_at, updated_valid_id_url, remarks, status')
      .eq('id', id)
      .single();

    if (renewalError || !renewal) {
      return NextResponse.json({ data: null, error: 'Renewal request not found.' }, { status: 404 });
    }

    if (!['Pending', 'Incomplete'].includes(String(renewal.status || ''))) {
      return NextResponse.json({ data: null, error: 'This renewal request has already been processed.' }, { status: 400 });
    }

    const { data: resident, error: residentError } = await supabaseAdmin
      .from('residents')
      .select('id, control_number, first_name, middle_name, last_name, contact_number, status')
      .eq('id', renewal.resident_id)
      .single();
    if (residentError || !resident) {
      return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
    }

    const processedBy = staffName(auth);
    const adminRemarks = String(body?.admin_remarks ?? body?.adminRemarks ?? '').trim() || null;

    if (action === 'incomplete') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('beneficiary_id_renewal_requests')
        .update({
          status: 'Incomplete',
          admin_remarks: adminRemarks,
          processed_by: processedBy,
          processed_at: new Date().toISOString(),
        })
        .eq('id', renewal.id)
        .select('id, resident_id, card_id, current_expires_at, updated_valid_id_url, remarks, status, admin_remarks, processed_by, processed_at, created_at, updated_at')
        .single();
      if (updateError) throw updateError;

      await supabaseAdmin.from('residents').update({ status: 'Renewal Pending' }).eq('id', renewal.resident_id);

      await logStaffActivity(auth, {
        action: 'Marked ID renewal incomplete',
        message: adminRemarks || 'Beneficiary ID renewal request needs more information.',
        entity_type: 'beneficiary_id_renewal_request',
        entity_id: renewal.id,
        reference_number: resident.control_number || String(renewal.id).slice(0, 8).toUpperCase(),
        link: '/admin/renewal-requests',
        audience_resident_id: renewal.resident_id,
      }, supabaseAdmin);

      await logActivity({
        actor_name: processedBy,
        actor_role: 'Admin',
        action: 'ID renewal incomplete',
        message: adminRemarks || 'Your Beneficiary ID renewal needs more information.',
        entity_type: 'beneficiary_id_renewal_request',
        entity_id: renewal.id,
        reference_number: resident.control_number || String(renewal.id).slice(0, 8).toUpperCase(),
        link: '/beneficiary/profile',
        audience_resident_id: renewal.resident_id,
      }, supabaseAdmin);

      const sms = await sendBeneficiaryIdRenewalIncompleteSms({
        contactNumber: resident.contact_number,
        remarks: adminRemarks,
        requestId: renewal.id,
      });

      return NextResponse.json({ data: updated, error: null, sms });
    }

    const { data: card, error: cardError } = await supabaseAdmin
      .from('beneficiary_cards')
      .select('id, expires_at')
      .eq('id', renewal.card_id)
      .single();
    if (cardError || !card) return NextResponse.json({ data: null, error: 'Beneficiary ID card not found.' }, { status: 404 });

    const newExpiration = computeRenewedExpiration(renewal.current_expires_at || card.expires_at);
    if (!newExpiration) return NextResponse.json({ data: null, error: 'Invalid current expiration date.' }, { status: 400 });
    const newExpirationIso = newExpiration.toISOString();

    const { error: cardUpdateError } = await supabaseAdmin
      .from('beneficiary_cards')
      .update({ expires_at: newExpirationIso, status: 'Active', revoked_at: null })
      .eq('id', card.id);
    if (cardUpdateError) throw cardUpdateError;

    const { error: residentUpdateError } = await supabaseAdmin
      .from('residents')
      .update({ status: 'Active', valid_id_url: renewal.updated_valid_id_url })
      .eq('id', renewal.resident_id);
    if (residentUpdateError) throw residentUpdateError;

    const { data: updated, error: renewalUpdateError } = await supabaseAdmin
      .from('beneficiary_id_renewal_requests')
      .update({
        status: 'Approved',
        admin_remarks: adminRemarks,
        processed_by: processedBy,
        processed_at: new Date().toISOString(),
      })
      .eq('id', renewal.id)
      .select('id, resident_id, card_id, current_expires_at, updated_valid_id_url, remarks, status, admin_remarks, processed_by, processed_at, created_at, updated_at')
      .single();
    if (renewalUpdateError) throw renewalUpdateError;

    await logStaffActivity(auth, {
      action: 'Approved ID renewal',
      message: `Beneficiary ID renewed until ${formatDate(newExpirationIso)}.`,
      entity_type: 'beneficiary_id_renewal_request',
      entity_id: renewal.id,
      reference_number: resident.control_number || String(renewal.id).slice(0, 8).toUpperCase(),
      link: '/admin/renewal-requests',
      audience_resident_id: renewal.resident_id,
    }, supabaseAdmin);

    await logActivity({
      actor_name: processedBy,
      actor_role: 'Admin',
      action: 'ID renewal approved',
      message: `Your Beneficiary ID is valid until ${formatDate(newExpirationIso)}.`,
      entity_type: 'beneficiary_id_renewal_request',
      entity_id: renewal.id,
      reference_number: resident.control_number || String(renewal.id).slice(0, 8).toUpperCase(),
      link: '/beneficiary/profile',
      audience_resident_id: renewal.resident_id,
    }, supabaseAdmin);

    const sms = await sendBeneficiaryIdRenewalApprovedSms({
      contactNumber: resident.contact_number,
      expirationDate: formatDate(newExpirationIso),
      requestId: renewal.id,
    });

    return NextResponse.json({ data: { ...updated, new_expires_at: newExpirationIso }, error: null, sms });
  } catch (error) {
    console.error('Update renewal request error:', error);
    return NextResponse.json({ data: null, error: error?.message || 'Failed to update renewal request.' }, { status: 500 });
  }
}
