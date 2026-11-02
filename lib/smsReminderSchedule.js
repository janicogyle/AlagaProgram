const DAY_MS = 86400000;
function manilaDay(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.floor((date.getTime() + 8 * 60 * 60 * 1000) / DAY_MS);
}

// Stable windows allow failed or missed daily runs to retry without sending the
// same milestone repeatedly. Successful sends are deduplicated by sms_logs.
export function getRenewalReminderStage(expiresAt, now = new Date()) {
  const expiry = manilaDay(expiresAt);
  const today = manilaDay(now);
  if (expiry === null || today === null) return null;
  const days = expiry - today;
  if (days <= 0) return 0;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  return null;
}
