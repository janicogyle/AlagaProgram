import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import {
  loadAccountRequestForResubmission,
  parseAccountRequestValidIdUrls,
  updateAccountRequestForResubmission,
} from '@/lib/accountResubmissionTokens.server';
import { filterCloudinaryUrls, validateCloudinaryDocumentUrls } from '@/lib/documentUrls.server';
import { logActivity } from '@/lib/activityLogger.server';
import { buildSectorPairFromSource, validateSectorPair } from '@/lib/beneficiarySectors';

export const runtime = 'nodejs';

const LOCKED_CITIZENSHIP = 'Filipino';
const SOLO_PARENT_MARRIED_ERROR = 'Married civil status is not allowed for Solo Parent classification.';
const MINOR_PWD_REPRESENTATIVE_ERROR =
  'Beneficiaries below 18 years old must provide a guardian or representative before registration can be completed.';
const VALID_ID_BOTH_SIDES_ERROR = 'Please upload both the front and back images of your valid ID.';
const FACE_VERIFICATION_FAILED_ERROR =
  'Face verification failed. Please make sure your selfie clearly matches the photo on your valid ID.';

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

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  if (digits.length > 11) return digits.slice(-11);
  return digits;
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
    primarySector: buildSectorPairFromSource(request).primarySector,
    secondarySector: buildSectorPairFromSource(request).secondarySector,
    houseNo: request.house_no || '',
    purok: request.purok || '',
    street: request.street || '',
    barangay: request.barangay || 'Sta. Rita',
    city: request.city || 'Olongapo City',
    isPwd: !!request.is_pwd,
    isSeniorCitizen: !!request.is_senior_citizen,
    isSoloParent: !!request.is_solo_parent,
    representativeName: request.representative_name || '',
    representativeContact: request.representative_contact || '',
    representativeRelationship: request.representative_relationship || '',
    representativeValidIdUrl: request.representative_valid_id_url || '',
    validIdUrls: effectiveValidIds,
    validIdFrontUrl: request.valid_id_front_url || effectiveValidIds[0] || '',
    validIdBackUrl: request.valid_id_back_url || effectiveValidIds[1] || '',
    selfieUrl: request.selfie_url || '',
    faceVerificationStatus: request.face_verification_status || '',
    faceVerificationScore: request.face_verification_score ?? null,
    faceVerificationProvider: request.face_verification_provider || '',
    faceVerifiedAt: request.face_verified_at || '',
    faceVerificationError: request.face_verification_error || '',
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

    const sectorValidation = validateSectorPair(body);
    if (!sectorValidation.ok) {
      return NextResponse.json({ data: null, error: sectorValidation.error }, { status: 400 });
    }
    const {
      primarySector,
      secondarySector,
      flags: { is_pwd: isPwd, is_senior_citizen: isSeniorCitizen, is_solo_parent: isSoloParent },
    } = sectorValidation;
    const sectorCount = [isPwd, isSeniorCitizen, isSoloParent].filter(Boolean).length;
    if (isSoloParent && String(civilStatus || '').trim().toLowerCase() === 'married') {
      return NextResponse.json({ data: null, error: SOLO_PARENT_MARRIED_ERROR }, { status: 400 });
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

    const validIdFrontUrl = cleanText(body.validIdFrontUrl || body.valid_id_front_url);
    const validIdBackUrl = cleanText(body.validIdBackUrl || body.valid_id_back_url);
    const selfieUrl = cleanText(body.selfieUrl || body.selfie_url);
    const faceVerificationStatus = cleanText(body.faceVerificationStatus || body.face_verification_status);
    const faceVerificationScore = body.faceVerificationScore ?? body.face_verification_score ?? null;
    const faceVerificationProvider = cleanText(body.faceVerificationProvider || body.face_verification_provider);
    const faceVerifiedAt = cleanText(body.faceVerifiedAt || body.face_verified_at);
    const faceVerificationError = cleanText(body.faceVerificationError || body.face_verification_error);

    if (!validIdFrontUrl || !validIdBackUrl) {
      return NextResponse.json({ data: null, error: VALID_ID_BOTH_SIDES_ERROR }, { status: 400 });
    }
    if (!selfieUrl) {
      return NextResponse.json({ data: null, error: 'Selfie/face capture is required.' }, { status: 400 });
    }
    const identityDocCheck = validateCloudinaryDocumentUrls([validIdFrontUrl, validIdBackUrl, selfieUrl], {
      label: 'Identity document',
    });
    if (!identityDocCheck.ok) {
      return NextResponse.json({ data: null, error: identityDocCheck.error }, { status: 400 });
    }
    const cloudinaryIdentityUrls = filterCloudinaryUrls([validIdFrontUrl, validIdBackUrl, selfieUrl]);
    if (cloudinaryIdentityUrls.length !== 3) {
      return NextResponse.json({ data: null, error: 'Identity documents must be uploaded to Cloudinary.' }, { status: 400 });
    }
    if (faceVerificationStatus !== 'passed') {
      return NextResponse.json({ data: null, error: FACE_VERIFICATION_FAILED_ERROR }, { status: 400 });
    }

    const requestedValidIds = parseAccountRequestValidIdUrls(body.validIdUrls ?? body.valid_id_urls);
    const effectiveRequestedValidIds = requestedValidIds.length ? requestedValidIds : [validIdFrontUrl, validIdBackUrl];
    if (effectiveRequestedValidIds.length) {
      const docCheck = validateCloudinaryDocumentUrls(effectiveRequestedValidIds, { label: 'Valid ID' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }

    const cloudinaryValidIds = filterCloudinaryUrls(effectiveRequestedValidIds);
    if (sectorCount > 0 && cloudinaryValidIds.length === 0) {
      return NextResponse.json(
        { data: null, error: 'Valid ID is required to verify your sector classification.' },
        { status: 400 },
      );
    }

    const representativeName = cleanText(body.representativeName || body.representative_name);
    const representativeContact = normalizeContactNumber(body.representativeContact || body.representative_contact);
    const representativeRelationship = cleanText(body.representativeRelationship || body.representative_relationship);
    const representativeValidIdUrl = cleanText(body.representativeValidIdUrl || body.representative_valid_id_url);
    const representativeUrls = representativeValidIdUrl ? [representativeValidIdUrl] : [];
    if (representativeUrls.length) {
      const docCheck = validateCloudinaryDocumentUrls(representativeUrls, { label: 'Representative valid ID' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }
    const cloudinaryRepresentativeUrls = filterCloudinaryUrls(representativeUrls);
    if (
      age < 18 &&
      isPwd &&
      (!representativeName ||
        !representativeContact ||
        representativeContact.length !== 11 ||
        !representativeRelationship ||
        cloudinaryRepresentativeUrls.length === 0)
    ) {
      return NextResponse.json({ data: null, error: MINOR_PWD_REPRESENTATIVE_ERROR }, { status: 400 });
    }
    if (representativeContact && representativeContact.length !== 11) {
      return NextResponse.json(
        { data: null, error: 'Guardian/Representative contact number must be exactly 11 digits.' },
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
      primary_sector: primarySector,
      secondary_sector: secondarySector || null,
      valid_id_url: validIdFrontUrl || cloudinaryValidIds[0] || null,
      valid_id_urls: cloudinaryValidIds,
      valid_id_front_url: validIdFrontUrl,
      valid_id_back_url: validIdBackUrl,
      selfie_url: selfieUrl,
      face_verification_status: faceVerificationStatus,
      face_verification_score: faceVerificationScore,
      face_verification_provider: faceVerificationProvider || null,
      face_verified_at: faceVerifiedAt || now,
      face_verification_error: faceVerificationError || null,
      representative_name: representativeName || null,
      representative_contact: representativeContact || null,
      representative_relationship: representativeRelationship || null,
      representative_valid_id_url: cloudinaryRepresentativeUrls[0] || null,
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
