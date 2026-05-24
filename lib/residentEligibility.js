import { getCooldownInfo, parseDateInput } from '@/lib/requestCooldown';

export const ACTIVE_REQUEST_STATUSES = new Set(['Pending', 'Resubmitted']);

/**
 * Build lookup maps from assistance request rows (resident_id, status, request_date, created_at).
 */
export function buildEligibilityMaps(requestRows = []) {
  const latestReleasedByResident = new Map();
  const activeByResident = new Map();

  requestRows.forEach((row) => {
    const residentId = row?.resident_id;
    if (!residentId) return;

    const status = String(row?.status || '');

    if (ACTIVE_REQUEST_STATUSES.has(status) && !activeByResident.has(residentId)) {
      activeByResident.set(residentId, row);
    }

    if (status.toLowerCase() !== 'released') return;

    const candidate = parseDateInput(row?.request_date || row?.created_at);
    if (!candidate) return;

    const existing = latestReleasedByResident.get(residentId);
    if (!existing || candidate > existing) {
      latestReleasedByResident.set(residentId, candidate);
    }
  });

  return { latestReleasedByResident, activeByResident };
}

export function getResidentEligibility(residentId, maps) {
  if (!residentId) {
    const cooldownInfo = getCooldownInfo(null);
    return { cooldownInfo, canCreateRequest: true, blockReason: null };
  }

  const active = maps?.activeByResident?.get(residentId);
  if (active) {
    return {
      cooldownInfo: {
        status: 'Under Review',
        isEligible: false,
        daysRemaining: 0,
        nextEligibleDate: null,
        lastRequestDate: active.request_date || active.created_at || null,
      },
      canCreateRequest: false,
      blockReason: 'active',
    };
  }

  const lastReleased = maps?.latestReleasedByResident?.get(residentId) || null;
  const cooldownInfo = getCooldownInfo(lastReleased);
  return {
    cooldownInfo,
    canCreateRequest: cooldownInfo.isEligible,
    blockReason: cooldownInfo.isEligible ? null : 'cooldown',
  };
}

export function buildEligibilityByResidentId(requestRows = []) {
  const maps = buildEligibilityMaps(requestRows);
  const ids = new Set();

  requestRows.forEach((row) => {
    if (row?.resident_id) ids.add(row.resident_id);
  });

  maps.latestReleasedByResident.forEach((_date, id) => ids.add(id));
  maps.activeByResident.forEach((_row, id) => ids.add(id));

  const byId = {};
  ids.forEach((id) => {
    byId[id] = getResidentEligibility(id, maps);
  });

  return { maps, byId };
}
