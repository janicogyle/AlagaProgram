import { getCooldownInfo, parseDateInput } from '@/lib/requestCooldown';

export const ACTIVE_REQUEST_STATUSES = new Set(['Pending', 'Resubmitted', 'Approved']);

const normalizeAssistanceType = (value) => String(value || '').trim();
const buildEligibilityKey = (residentId, assistanceType) =>
  `${String(residentId || '').trim()}::${normalizeAssistanceType(assistanceType)}`;

const getRowDate = (row) => parseDateInput(row?.request_date || row?.created_at);

const keepLatestReleased = (map, key, row) => {
  const candidate = getRowDate(row);
  if (!candidate) return;

  const existing = map.get(key);
  if (!existing || candidate > existing.date) {
    map.set(key, { date: candidate, row });
  }
};

/**
 * Build lookup maps from assistance request rows.
 *
 * Category maps are keyed by resident_id + assistance_type so duplicate-benefit
 * checks are scoped to one assistance category, independent of sector tags.
 */
export function buildEligibilityMaps(requestRows = []) {
  const latestReleasedByResident = new Map();
  const activeByResident = new Map();
  const latestReleasedByResidentAndType = new Map();
  const activeByResidentAndType = new Map();

  requestRows.forEach((row) => {
    const residentId = row?.resident_id;
    if (!residentId) return;

    const status = String(row?.status || '');
    const assistanceType = normalizeAssistanceType(row?.assistance_type);
    const categoryKey = buildEligibilityKey(residentId, assistanceType);

    if (ACTIVE_REQUEST_STATUSES.has(status) && !activeByResident.has(residentId)) {
      activeByResident.set(residentId, row);
    }

    if (assistanceType && ACTIVE_REQUEST_STATUSES.has(status) && !activeByResidentAndType.has(categoryKey)) {
      activeByResidentAndType.set(categoryKey, row);
    }

    if (status.toLowerCase() !== 'released') return;

    keepLatestReleased(latestReleasedByResident, residentId, row);
    if (assistanceType) keepLatestReleased(latestReleasedByResidentAndType, categoryKey, row);
  });

  return {
    latestReleasedByResident,
    activeByResident,
    latestReleasedByResidentAndType,
    activeByResidentAndType,
  };
}

export function getResidentEligibility(residentId, maps, assistanceType = null) {
  if (!residentId) {
    const cooldownInfo = getCooldownInfo(null);
    return { cooldownInfo, canCreateRequest: true, blockReason: null };
  }

  const normalizedType = normalizeAssistanceType(assistanceType);
  const categoryKey = normalizedType ? buildEligibilityKey(residentId, normalizedType) : null;
  const active = categoryKey
    ? maps?.activeByResidentAndType?.get(categoryKey)
    : maps?.activeByResident?.get(residentId);

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
      activeRequest: active,
    };
  }

  const releasedEntry = categoryKey
    ? maps?.latestReleasedByResidentAndType?.get(categoryKey)
    : maps?.latestReleasedByResident?.get(residentId);
  const lastReleased = releasedEntry?.date || releasedEntry || null;
  const cooldownInfo = getCooldownInfo(lastReleased);
  return {
    cooldownInfo,
    canCreateRequest: cooldownInfo.isEligible,
    blockReason: cooldownInfo.isEligible ? null : 'cooldown',
    assistanceType: normalizedType || null,
  };
}

export function buildEligibilityByResidentId(requestRows = []) {
  const maps = buildEligibilityMaps(requestRows);
  const ids = new Set();

  requestRows.forEach((row) => {
    if (row?.resident_id) ids.add(row.resident_id);
  });

  maps.latestReleasedByResident.forEach((_entry, id) => ids.add(id));
  maps.activeByResident.forEach((_row, id) => ids.add(id));

  const byId = {};
  ids.forEach((id) => {
    byId[id] = getResidentEligibility(id, maps);
  });

  return { maps, byId };
}
