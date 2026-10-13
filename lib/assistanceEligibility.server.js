import { buildEligibilityMaps, getResidentEligibility } from '@/lib/residentEligibility';

export const ASSISTANCE_ELIGIBILITY_STATUSES = [
  'Pending',
  'Resubmitted',
  'Approved',
  'Released',
  'Rejected',
  'Incomplete',
];

function isMissingReleasedAt(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('released_at') && (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find')
  );
}

export async function loadResidentAssistanceEligibility(db, residentId) {
  const baseFields = 'id, control_number, resident_id, assistance_type, status, request_date, created_at, updated_at';
  let { data, error } = await db
    .from('assistance_requests')
    .select(`${baseFields}, released_at`)
    .eq('resident_id', residentId)
    .in('status', ASSISTANCE_ELIGIBILITY_STATUSES);

  if (error && isMissingReleasedAt(error)) {
    ({ data, error } = await db
      .from('assistance_requests')
      .select(baseFields)
      .eq('resident_id', residentId)
      .in('status', ASSISTANCE_ELIGIBILITY_STATUSES));
  }

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const maps = buildEligibilityMaps(rows);
  return { rows, maps, ...getResidentEligibility(residentId, maps) };
}

export function getAssistanceEligibilityFailure(eligibility) {
  if (!eligibility || eligibility.canCreateRequest) return null;

  if (eligibility.blockReason === 'active') {
    const request = eligibility.activeRequest;
    const status = String(request?.status || 'Pending');
    const approved = status === 'Approved';
    return {
      status: 409,
      code: 'ACTIVE_REQUEST_EXISTS',
      error: approved
        ? 'This beneficiary already has an approved assistance request. It must be released before another request can be submitted.'
        : 'This beneficiary already has an assistance request under review. Wait for it to be completed before submitting another request.',
      activeRequest: request || null,
    };
  }

  if (eligibility.blockReason === 'incomplete') {
    return {
      status: 409,
      code: 'INCOMPLETE_REQUEST_EXISTS',
      error: 'This beneficiary has an incomplete assistance request. Edit and resubmit the existing request instead of creating a new one.',
      activeRequest: eligibility.editableRequest || null,
    };
  }

  const cooldown = eligibility.cooldownInfo;
  return {
    status: 429,
    code: 'REQUEST_COOLDOWN',
    error: `Please wait ${cooldown?.daysRemaining || 0} day(s) before submitting another assistance request. Next eligible on ${cooldown?.nextEligibleDate || '-'}.`,
    cooldown,
  };
}
