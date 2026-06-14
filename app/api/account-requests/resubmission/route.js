import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  loadAccountRequestForResubmission,
  parseAccountRequestValidIdUrls,
  updateAccountRequestForResubmission,
} from '@/lib/accountResubmissionTokens.server';
import { filterCloudinaryUrls, validateCloudinaryDocumentUrls } from '@/lib/documentUrls.server';
import { logActivity } from '@/lib/activityLogger.server';

export const runtime = 'nodejs';

const LOCKED_CITIZENSHIP = 'Filipino';

function isResubmissionSchemaError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('valid_id_urls') ||
    msg.includes('resubmission_token_hash') ||
    msg.includes('resubmitted_at') ||
    (msg.includes('resubmission') && msg.includes('schema cache')) ||
    msg.includes('schema is missing required account_requests')
  );
}

function calculateAge(dob) {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function cleanText(value) {
  return String(value || '').trim();
}

function toPublicPayload(request) {
  const validIdUrls = parseAccountRequestValidIdUrls(request.valid_id_urls);
  const fallback = parseAccountRequestValidIdUrls(request.valid_id_url);
  const effectiveValidIds = validIdUrls.length ? validIdUrls : fallback;

  return {
    id: request.id,
    status: request.status,
    notes: request.notes || null,
    resubmissionSentAt: request.resubmission_sent_at || null,
    firstName: request.first_name || '',
    middleName: request.middle_name || '',
    lastName: request.last_name || '',
    birthday: request.birthday || '',
    age: request.age ?? null,
    birthplace: request.birthplace || '',
    sex: request.sex || '',
    citizenship: request.citizenship || LOCKED_CITIZENSHIP,
    civilStatus: request.civil_status || '',
    contactNumber: request.contact_number || '',
    houseNo: request.house_no || '',
    purok: request.purok || '',
    street: request.street || '',
    barangay: request.barangay || 'Sta. Rita',
    city: request.city || 'Olongapo City',
    isPwd: !!request.is_pwd,
    isSeniorCitizen: !!request.is_senior_citizen,
    isSoloParent: !!request.is_solo_parent,
    validIdUrls: effectiveValidIds,
  };
}

export async function GET(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const lookup = await loadAccountRequestForResubmission(supabaseAdmin, token);
    if (!lookup.ok) {
      return NextResponse.json({ data: null, error: lookup.error }, { status: lookup.status });
    }

    return NextResponse.json({ data: toPublicPayload(lookup.request), error: null });
  } catch (error) {
    console.error('Fetch account request resubmission error:', error);
    return NextResponse.json(
      {
        data: null,
        error: isResubmissionSchemaError(error)
          ? 'Account request resubmission is not configured yet. Please contact the barangay office.'
          : error?.message || 'Failed to load resubmission request.',
      },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database admin client not available.' },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const lookup = await loadAccountRequestForResubmission(supabaseAdmin, body?.token);
    if (!lookup.ok) {
      return NextResponse.json({ data: null, error: lookup.error }, { status: lookup.status });
    }

    const firstName = cleanText(body.firstName);
    const lastName = cleanText(body.lastName);
    const birthday = cleanText(body.birthday);
    const birthplace = cleanText(body.birthplace);
    const sex = cleanText(body.sex);
    const civilStatus = cleanText(body.civilStatus || body.civil_status);
    const houseNo = cleanText(body.houseNo);
    const purok = cleanText(body.purok);

    if (!firstName || !lastName || !birthday || !birthplace || !sex || !civilStatus || !houseNo || !purok) {
      return NextResponse.json({ data: null, error: 'Missing required fields.' }, { status: 400 });
    }

    const isPwd = !!body.isPwd;
    const isSeniorCitizen = !!body.isSeniorCitizen;
    const isSoloParent = !!body.isSoloParent;
    const sectorCount = [isPwd, isSeniorCitizen, isSoloParent].filter(Boolean).length;
    if (sectorCount > 1) {
      return NextResponse.json(
        { data: null, error: 'Only one sector classification can be selected.' },
        { status: 400 },
      );
    }

    const age = calculateAge(birthday);
    if (age === null || age < 0) {
      return NextResponse.json({ data: null, error: 'Please provide a valid birthday.' }, { status: 400 });
    }
    if (age < 18 && !isPwd) {
      return NextResponse.json(
        { data: null, error: 'You must be at least 18 years old unless classified as PWD.' },
        { status: 400 },
      );
    }
    if (isSeniorCitizen && age < 60) {
      return NextResponse.json(
        { data: null, error: 'Senior Citizen selection requires age 60 or above.' },
        { status: 400 },
      );
    }

    const requestedValidIds = parseAccountRequestValidIdUrls(body.validIdUrls ?? body.valid_id_urls);
    if (requestedValidIds.length) {
      const docCheck = validateCloudinaryDocumentUrls(requestedValidIds, { label: 'Valid ID' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }

    const cloudinaryValidIds = filterCloudinaryUrls(requestedValidIds);
    if (sectorCount > 0 && cloudinaryValidIds.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Valid ID is required to verify your sector classification.' },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const { data, error } = await updateAccountRequestForResubmission(supabaseAdmin, lookup.request.id, {
      first_name: firstName,
      middle_name: cleanText(body.middleName) || null,
      last_name: lastName,
      birthday,
      age,
      birthplace,
      sex,
      citizenship: LOCKED_CITIZENSHIP,
      civil_status: civilStatus,
      house_no: houseNo,
      purok,
      street: cleanText(body.street) || null,
      barangay: cleanText(body.barangay) || 'Sta. Rita',
      city: cleanText(body.city) || 'Olongapo City',
      is_pwd: isPwd,
      is_senior_citizen: isSeniorCitizen,
      is_solo_parent: isSoloParent,
      valid_id_url: cloudinaryValidIds[0] || null,
      valid_id_urls: cloudinaryValidIds,
      status: 'Resubmitted',
      processed_by: null,
      processed_at: null,
      resubmitted_at: now,
      resubmission_token_hash: null,
      resubmission_token_created_at: null,
    });

    if (error) throw error;

    await logActivity(
      {
        actor_name: [firstName, cleanText(body.middleName), lastName].filter(Boolean).join(' ') || 'Beneficiary',
        actor_role: 'Beneficiary',
        action: 'Resubmitted account request',
        message: 'Beneficiary corrected an incomplete signup request.',
        entity_type: 'account_request',
        entity_id: data?.id || lookup.request.id,
        reference_number: lookup.request.contact_number || lookup.request.id,
        link: '/admin/account-requests',
      },
      supabaseAdmin,
    );

    return NextResponse.json({ data, error: null, message: 'Your corrected signup details were submitted.' });
  } catch (error) {
    console.error('Submit account request resubmission error:', error);
    return NextResponse.json(
      {
        data: null,
        error: isResubmissionSchemaError(error)
          ? 'Database update failed. Ask the barangay admin to run setup-step16-account-request-valid-id-urls.sql in Supabase SQL Editor, then try again.'
          : error?.message || 'Failed to submit corrected details.',
      },
      { status: 500 },
    );
  }
}
