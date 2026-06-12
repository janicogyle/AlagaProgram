export const BENEFICIARY_RESIDENT_STATUSES = ['Active', 'Expiring Soon', 'Expired', 'Renewal Pending'];
export const BENEFICIARY_CARD_STATUSES = ['Active', 'Expiring Soon', 'Expired'];
export const RESTRICTED_BENEFICIARY_STATUSES = new Set(['Expired', 'Renewal Pending']);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;
const RENEWAL_WINDOW_DAYS = 7;

export function addOneYear(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

export function computeRenewedExpiration(currentExpiresAt, nowInput = new Date()) {
  const now = new Date(nowInput);
  const current = new Date(currentExpiresAt);
  const base = Number.isFinite(current.getTime()) && current > now ? current : now;
  return addOneYear(base);
}

export function computeBeneficiaryIdStatus({ card, residentStatus, nowInput = new Date() } = {}) {
  const normalizedResidentStatus = String(residentStatus || '').trim();
  if (normalizedResidentStatus === 'Renewal Pending') return 'Renewal Pending';
  if (normalizedResidentStatus === 'Expired') return 'Expired';
  if (!card) return normalizedResidentStatus || 'Expired';
  if (card.revoked_at) return 'Expired';

  const expiresAtMs = card.expires_at ? new Date(card.expires_at).getTime() : NaN;
  if (!Number.isFinite(expiresAtMs)) return normalizedResidentStatus || 'Expired';

  const now = new Date(nowInput).getTime();
  if (expiresAtMs <= now) return 'Expired';

  const daysRemaining = Math.ceil((expiresAtMs - now) / MS_PER_DAY);
  if (daysRemaining <= EXPIRING_SOON_DAYS) return 'Expiring Soon';

  return 'Active';
}

export function getDaysUntilExpiration(expiresAt, nowInput = new Date()) {
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  if (!Number.isFinite(expiresAtMs)) return null;

  const now = new Date(nowInput).getTime();
  return Math.ceil((expiresAtMs - now) / MS_PER_DAY);
}

export function computeBeneficiaryRenewalEligibility({ card, idStatus, residentStatus, latestRequest, nowInput = new Date() } = {}) {
  const effectiveStatus = idStatus || computeBeneficiaryIdStatus({ card, residentStatus, nowInput });
  const daysUntilExpiration = getDaysUntilExpiration(card?.expires_at, nowInput);
  const pendingReview = latestRequest?.status === 'Pending';
  const incompleteResubmission = latestRequest?.status === 'Incomplete';
  const canRenew = pendingReview
    ? false
    : incompleteResubmission ||
      effectiveStatus === 'Expired' ||
      (daysUntilExpiration !== null && daysUntilExpiration <= RENEWAL_WINDOW_DAYS);

  return {
    canRenew,
    daysUntilExpiration,
    renewalWindowDays: RENEWAL_WINDOW_DAYS,
  };
}

export function getQrScanStatus(idStatus) {
  if (idStatus === 'Expiring Soon') {
    return { label: 'EXPIRING SOON', valid: true, reason: null };
  }
  if (idStatus === 'Active') {
    return { label: 'ACTIVE', valid: true, reason: null };
  }
  if (idStatus === 'Renewal Pending') {
    return { label: 'RENEWAL PENDING', valid: false, reason: 'renewal_pending' };
  }
  return { label: 'EXPIRED - RENEWAL REQUIRED', valid: false, reason: 'expired' };
}
