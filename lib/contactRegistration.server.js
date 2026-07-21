import { normalizeSmsContactNumber } from '@/lib/sms.server';

function normalizeEmail(input) {
  return String(input || '').trim().toLowerCase();
}

/**
 * Returns an error message if the contact number cannot be used for signup, else null.
 */
export async function getSignupContactUnavailableReason(db, contactNumber) {
  if (!db) {
    return 'Server configuration error. Database client not available.';
  }

  const normalized = normalizeSmsContactNumber(contactNumber);
  if (!normalized) {
    return 'Contact number must be 11 digits.';
  }

  const { data: existingRequest, error: requestError } = await db
    .from('account_requests')
    .select('id, status')
    .eq('contact_number', normalized)
    .limit(1)
    .maybeSingle();

  if (requestError && requestError.code !== 'PGRST116') {
    throw requestError;
  }

  if (existingRequest) {
    return 'This contact number has already been used. Please log in or use a different number.';
  }

  try {
    const { data: existingResident, error: residentError } = await db
      .from('residents')
      .select('id')
      .eq('contact_number', normalized)
      .limit(1)
      .maybeSingle();

    if (!residentError && existingResident) {
      return 'This contact number is already registered';
    }
  } catch {
    // residents table may be unavailable in some environments
  }

  return null;
}

export async function isSignupContactAvailable(db, contactNumber) {
  const reason = await getSignupContactUnavailableReason(db, contactNumber);
  return { available: !reason, error: reason };
}

/**
 * Returns an error message if the email cannot be used for signup, else null.
 */
export async function getSignupEmailUnavailableReason(db, email) {
  if (!db) {
    return 'Server configuration error. Database client not available.';
  }

  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return 'Please enter a valid Gmail or email address.';
  }

  const { data: existingRequest, error: requestError } = await db
    .from('account_requests')
    .select('id, status')
    .ilike('email', normalized)
    .limit(1)
    .maybeSingle();

  if (requestError && requestError.code !== 'PGRST116') {
    throw requestError;
  }

  if (existingRequest) {
    return 'This email address has already been used. Please log in or use a different email address.';
  }

  try {
    const { data: existingResident, error: residentError } = await db
      .from('residents')
      .select('id')
      .ilike('email', normalized)
      .limit(1)
      .maybeSingle();

    if (!residentError && existingResident) {
      return 'This email address is already registered';
    }
  } catch {
    // residents.email may be unavailable in older environments
  }

  return null;
}

export async function isSignupEmailAvailable(db, email) {
  const reason = await getSignupEmailUnavailableReason(db, email);
  return { available: !reason, error: reason };
}

/**
 * Walk-in / admin registration: block duplicate contact unless updating the same resident.
 */
export async function getWalkInContactUnavailableReason(db, contactNumber, options = {}) {
  const excludeResidentId = options.excludeResidentId ? String(options.excludeResidentId) : '';

  if (!db) {
    return 'Server configuration error. Database client not available.';
  }

  const normalized = normalizeSmsContactNumber(contactNumber);
  if (!normalized) {
    return 'Contact number must be 11 digits.';
  }

  const { data: existingRequest, error: requestError } = await db
    .from('account_requests')
    .select('id, status')
    .eq('contact_number', normalized)
    .limit(1)
    .maybeSingle();

  if (requestError && requestError.code !== 'PGRST116') {
    throw requestError;
  }

  if (existingRequest) {
    return 'This contact number already has an online account request. Use Beneficiaries to find the existing record.';
  }

  try {
    const { data: existingResident, error: residentError } = await db
      .from('residents')
      .select('id, control_number')
      .eq('contact_number', normalized)
      .limit(1)
      .maybeSingle();

    if (!residentError && existingResident) {
      if (excludeResidentId && String(existingResident.id) === excludeResidentId) {
        return null;
      }
      return 'This contact number is already registered';
    }
  } catch {
    // residents table may be unavailable in some environments
  }

  return null;
}

export async function isWalkInContactAvailable(db, contactNumber, options = {}) {
  const reason = await getWalkInContactUnavailableReason(db, contactNumber, options);
  return { available: !reason, error: reason };
}
