import { normalizeSmsContactNumber } from '@/lib/sms.server';

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
      return 'This contact number is already registered. Please log in instead.';
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
