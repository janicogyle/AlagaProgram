import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { validateSectorPair } from '@/lib/beneficiarySectors';
import { getAllowedSectorKeys, forbiddenSectorResponse, rowMatchesSectorAccess } from '@/lib/sectorAccess';
import { createOrUpdateResident } from '@/lib/residents';
import { hashPassword } from '@/lib/passwords.server';
import { issueBeneficiaryCard } from '@/lib/beneficiaryCards.server';
import { queryNextAssistanceControlNumber, queryNextBeneficiaryControlNumber } from '@/lib/controlNumbers';
import { logStaffActivity } from '@/lib/activityLogger.server';

export const runtime = 'nodejs';

const ALLOWED_ASSISTANCE_TYPES = new Set(['Medicine Assistance', 'Confinement Assistance', 'Burial Assistance']);

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeContactNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('63')) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function calculateAge(birthday) {
  const date = new Date(`${birthday}T00:00:00`);
  if (!birthday || Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const beforeBirthday = today.getMonth() < date.getMonth() ||
    (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function isAllowedPhotoUrl(value) {
  const url = clean(value);
  // Development's existing upload fallback intentionally uses a local-dev Cloudinary URL.
  return /^https:\/\/res\.cloudinary\.com\/(?!$)/i.test(url);
}

function fullName(body) {
  return [body.firstName, body.middleName, body.lastName].map(clean).filter(Boolean).join(' ');
}

function address(body) {
  return [clean(body.houseNo), body.purok ? `Purok ${clean(body.purok)}` : '', 'Sta. Rita', clean(body.city || 'Olongapo')]
    .filter(Boolean)
    .join(', ');
}

function stripMissingAssistanceColumn(message, payload) {
  const text = String(message || '');
  const match =
    text.match(/Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i) ||
    text.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does not exist/i) ||
    text.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of relation\s+"(?:public\.)?assistance_requests"\s+does not exist/i);
  const column = match?.[1];
  if (!column || !payload || typeof payload !== 'object' || !(column in payload)) return null;
  delete payload[column];
  return column;
}

export async function POST(request) {
  const auth = await requireStaffOrAdmin(request);
  if (!auth.ok) return auth.response;
  if (!supabaseAdmin) {
    return NextResponse.json({ data: null, error: 'Server configuration error. Missing Supabase service role.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const firstName = clean(body.firstName);
    const lastName = clean(body.lastName);
    const contactNumber = normalizeContactNumber(body.contactNumber);
    const password = String(body.accountPassword || '');
    const existingResidentId = clean(body.existingResidentId);
    const photoUrl = clean(body.profilePhotoUrl);
    const sector = validateSectorPair({ primarySector: body.primarySector, secondarySector: body.secondarySector });

    if (!firstName || !lastName || !clean(body.houseNo) || !clean(body.purok) || !body.birthday || !clean(body.birthplace) || !clean(body.sex) || !clean(body.civilStatus)) {
      return NextResponse.json({ data: null, error: 'Complete all required beneficiary information.' }, { status: 400 });
    }
    if (contactNumber.length !== 11) {
      return NextResponse.json({ data: null, error: 'Contact number must be exactly 11 digits.' }, { status: 400 });
    }
    if (!existingResidentId && password.length < 8) {
      return NextResponse.json({ data: null, error: 'Beneficiary account password must be at least 8 characters.' }, { status: 400 });
    }
    if (!existingResidentId && !isAllowedPhotoUrl(photoUrl)) {
      return NextResponse.json({ data: null, error: 'A captured or uploaded beneficiary photo is required.' }, { status: 400 });
    }
    if (!sector.ok) return NextResponse.json({ data: null, error: sector.error }, { status: 400 });

    const allowedSectors = getAllowedSectorKeys(auth.profile);
    const requestedSectors = [sector.primarySector, sector.secondarySector].filter(Boolean);
    if (auth.profile.role !== 'Admin' && requestedSectors.some((key) => !allowedSectors.includes(key))) {
      return forbiddenSectorResponse(NextResponse, 'You can only register beneficiaries in your assigned category.');
    }
    if (auth.profile.role !== 'Admin' && requestedSectors.length !== 1) {
      return forbiddenSectorResponse(NextResponse, 'Staff may register exactly one beneficiary category: their assigned category.');
    }

    if (existingResidentId) {
      const { data: existingResident, error: existingError } = await supabaseAdmin
        .from('residents')
        .select('id, is_pwd, is_senior_citizen, is_solo_parent')
        .eq('id', existingResidentId)
        .maybeSingle();
      if (existingError || !existingResident) return NextResponse.json({ data: null, error: 'Beneficiary not found.' }, { status: 404 });
      if (!rowMatchesSectorAccess(existingResident, auth.profile)) {
        return forbiddenSectorResponse(NextResponse, 'Beneficiary is outside your assigned sector access.');
      }
    } else {
      const { data: existingResident, error: residentLookupError } = await supabaseAdmin
        .from('residents')
        .select('id')
        .eq('contact_number', contactNumber)
        .maybeSingle();
      if (residentLookupError) throw residentLookupError;
      if (existingResident) {
        return NextResponse.json({ data: null, error: 'A beneficiary account already exists for this contact number.' }, { status: 409 });
      }
    }

    if (!existingResidentId) {
      const { data: existingRequest, error: requestLookupError } = await supabaseAdmin
        .from('account_requests')
        .select('id, status')
        .eq('contact_number', contactNumber)
        .maybeSingle();
      if (requestLookupError && requestLookupError.code !== 'PGRST116') throw requestLookupError;
      if (existingRequest) {
        return NextResponse.json({ data: null, error: 'A beneficiary registration already exists for this contact number.' }, { status: 409 });
      }
    }

    const age = calculateAge(body.birthday);
    if (age == null) return NextResponse.json({ data: null, error: 'Please provide a valid birthday.' }, { status: 400 });
    if (sector.flags.is_senior_citizen && age < 60) {
      return NextResponse.json({ data: null, error: 'Senior Citizen registration requires age 60 or above.' }, { status: 400 });
    }
    if (sector.flags.is_solo_parent && clean(body.civilStatus).toLowerCase() === 'married') {
      return NextResponse.json({ data: null, error: 'Married civil status is not allowed for Solo Parent classification.' }, { status: 400 });
    }

    const controlNumber = await queryNextBeneficiaryControlNumber(supabaseAdmin);
    const passwordHash = password ? await hashPassword(password) : null;
    let resident = null;
    let card = null;
    let assistanceRequest = null;

    try {
      resident = await createOrUpdateResident({
        ...(existingResidentId ? { id: existingResidentId } : { control_number: controlNumber }),
        first_name: firstName,
        middle_name: clean(body.middleName) || null,
        last_name: lastName,
        house_no: clean(body.houseNo),
        purok: clean(body.purok),
        barangay: 'sta-rita',
        city: clean(body.city || 'Olongapo'),
        birthday: body.birthday,
        age,
        birthplace: clean(body.birthplace),
        sex: clean(body.sex),
        citizenship: 'Filipino',
        civil_status: clean(body.civilStatus),
        contact_number: contactNumber,
        primary_sector: sector.primarySector,
        secondary_sector: sector.secondarySector || null,
        ...sector.flags,
        representative_name: clean(body.representativeName) || null,
        representative_contact: normalizeContactNumber(body.representativeContact) || null,
        representative_relationship: clean(body.representativeRelationship) || null,
        ...(photoUrl ? { profile_photo_url: photoUrl } : {}),
        ...(passwordHash ? { password_hash: passwordHash } : {}),
        status: 'Active',
      }, { allowContactMerge: false });

      const residentId = resident?.id;
      if (!residentId) throw new Error('Beneficiary record was created but its ID could not be resolved.');

      if (!existingResidentId) {
        const issued = await issueBeneficiaryCard(supabaseAdmin, residentId, { expiresInDays: 365 });
        card = issued.card;
      }

      const assistanceType = clean(body.assistanceType);
      if (assistanceType) {
        if (!ALLOWED_ASSISTANCE_TYPES.has(assistanceType)) throw new Error('Unsupported assistance type.');
        const assistanceControlNumber = await queryNextAssistanceControlNumber(supabaseAdmin, assistanceType);
        const checklist = Array.isArray(body.requirementsChecklist) ? body.requirementsChecklist : [];
        const requirementsCompleted = checklist.length ? checklist.every((item) => item?.checked === true) : body.requirementsCompleted === true;
        const assistancePayload = {
          control_number: assistanceControlNumber,
          resident_id: residentId,
          requester_name: clean(body.representativeName) || fullName(body),
          requester_contact: normalizeContactNumber(body.representativeContact) || contactNumber,
          requester_address: address(body),
          beneficiary_name: fullName(body),
          beneficiary_contact: contactNumber,
          beneficiary_address: address(body),
          assistance_type: assistanceType,
          amount: Number(body.assistanceAmount || 0),
          status: 'Pending',
          request_date: body.dateOfRequest || new Date().toISOString().slice(0, 10),
          request_source: 'walk-in',
          requirements_checklist: checklist,
          requirements_completed: requirementsCompleted,
        };
        let data;
        let error;
        for (let attempt = 0; attempt < 8; attempt += 1) {
          ({ data, error } = await supabaseAdmin
            .from('assistance_requests')
            .insert(assistancePayload)
            .select('id, control_number, status, assistance_type')
            .single());
          if (!error) break;
          const removed = stripMissingAssistanceColumn(error.message, assistancePayload);
          if (!removed) break;
        }
        if (error) throw error;
        assistanceRequest = data;
      }
    } catch (error) {
      if (resident?.id && !existingResidentId) {
        await supabaseAdmin.from('beneficiary_cards').delete().eq('resident_id', resident.id);
        await supabaseAdmin.from('residents').delete().eq('id', resident.id);
      }
      throw error;
    }

    await logStaffActivity(auth, {
      action: 'Registered beneficiary account',
      message: `Created beneficiary account, QR ID, and${assistanceRequest ? ' initial assistance request.' : ' no initial assistance request.'}`,
      entity_type: 'resident',
      entity_id: resident.id,
      reference_number: controlNumber,
      link: '/admin/residents',
      audience_resident_id: resident.id,
    }, supabaseAdmin);

    return NextResponse.json({
      data: { resident, beneficiary_card: card, assistance_request: assistanceRequest },
      error: null,
    }, { status: 201 });
  } catch (error) {
    console.error('Admin registration error:', error);
    const message = String(error?.message || 'Failed to register beneficiary.');
    const duplicate = error?.code === '23505' || /duplicate|already exists/i.test(message);
    return NextResponse.json({ data: null, error: duplicate ? 'A matching beneficiary or request already exists.' : message }, { status: duplicate ? 409 : 500 });
  }
}