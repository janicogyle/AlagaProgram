import { getCooldownInfo, parseDateInput } from './requestCooldown.js';

export const ACTIVE_REQUEST_STATUSES = new Set(['Pending', 'Resubmitted', 'Approved']);
export const INCOMPLETE_REQUEST_STATUSES = new Set(['Rejected', 'Incomplete']);

const normalizeAssistanceType = (value) => String(value || '').trim();
const buildEligibilityKey = (residentId, assistanceType) =>
  `${String(residentId || '').trim()}::${normalizeAssistanceType(assistanceType)}`;

const getRowDate = (row) => parseDateInput(
  row?.released_at || row?.updated_at || row?.request_date || row?.created_at,
);
const getCreatedDate = (row) => parseDateInput(row?.created_at || row?.updated_at || row?.request_date);

const keepLatestRow = (map, key, row, getDate = getCreatedDate) => {
  const candidate = getDate(row);
  if (!candidate) return;
  const existing = map.get(key);
  if (!existing || candidate > existing.date) map.set(key, { date: candidate, row });
};

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
 * Resident-wide maps drive creation eligibility across online and walk-in
 * channels. Category maps remain available for existing reporting consumers.
 */
export function buildEligibilityMaps(requestRows = []) {
  const latestReleasedByResident = new Map();
  const activeByResident = new Map();
  const latestRequestByResident = new Map();
  const latestReleasedByResidentAndType = new Map();
  const activeByResidentAndType = new Map();

  requestRows.forEach((row) => {
    const residentId = row?.resident_id;
    if (!residentId) return;

    const status = String(row?.status || '');
    const assistanceType = normalizeAssistanceType(row?.assistance_type);
    const categoryKey = buildEligibilityKey(residentId, assistanceType);

    keepLatestRow(latestRequestByResident, residentId, row);

    if (ACTIVE_REQUEST_STATUSES.has(status)) {
      const existing = activeByResident.get(residentId);
      if (!existing || getCreatedDate(row) > getCreatedDate(existing)) activeByResident.set(residentId, row);
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
    latestRequestByResident,
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
  const active = maps?.activeByResident?.get(residentId);

  if (active) {
    return {
      cooldownInfo: {
        status: active.status === 'Approved' ? 'Approved' : 'Pending',
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

  const latestRequest = maps?.latestRequestByResident?.get(residentId)?.row || null;
  if (latestRequest && INCOMPLETE_REQUEST_STATUSES.has(String(latestRequest.status || ''))) {
    return {
      cooldownInfo: {
        status: 'Incomplete',
        isEligible: false,
        daysRemaining: 0,
        nextEligibleDate: null,
        lastRequestDate: latestRequest.request_date || latestRequest.created_at || null,
      },
      canCreateRequest: false,
      blockReason: 'incomplete',
      editableRequest: latestRequest,
      assistanceType: normalizedType || null,
    };
  }

  const releasedEntry = maps?.latestReleasedByResident?.get(residentId);
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
  maps.latestRequestByResident.forEach((_entry, id) => ids.add(id));

  const byId = {};
  ids.forEach((id) => {
    byId[id] = getResidentEligibility(id, maps);
  });

  return { maps, byId };
}
