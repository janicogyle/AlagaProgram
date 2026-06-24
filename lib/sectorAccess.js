export const SECTOR_ACCESS = {
  pwd: {
    key: 'pwd',
    label: 'PWD',
    column: 'is_pwd',
    requestField: 'is_pwd',
  },
  senior_citizen: {
    key: 'senior_citizen',
    label: 'Senior Citizen',
    column: 'is_senior_citizen',
    requestField: 'is_senior_citizen',
  },
  solo_parent: {
    key: 'solo_parent',
    label: 'Solo Parent',
    column: 'is_solo_parent',
    requestField: 'is_solo_parent',
  },
};

export const SECTOR_ACCESS_KEYS = Object.keys(SECTOR_ACCESS);

export function normalizeSectorAccess(value) {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = raw.split(',');
    }
  }

  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item || '').trim().toLowerCase())
        .map((item) => {
          if (item === 'senior' || item === 'senior citizen') return 'senior_citizen';
          if (item === 'solo' || item === 'solo parent' || item === 'soloparent') return 'solo_parent';
          return item;
        })
        .filter((item) => SECTOR_ACCESS_KEYS.includes(item)),
    ),
  );
}

export function normalizeProfileSectorAccess(profile) {
  if (!profile || profile.role === 'Admin') return [];
  return normalizeSectorAccess(profile.sector_access);
}

export function isAdminProfile(profile) {
  return profile?.role === 'Admin';
}

export function getAllowedSectorKeys(profile) {
  if (isAdminProfile(profile)) return SECTOR_ACCESS_KEYS;
  return normalizeProfileSectorAccess(profile);
}

export function getSectorLabels(keys) {
  return normalizeSectorAccess(keys).map((key) => SECTOR_ACCESS[key].label);
}

export function rowMatchesSectorAccess(row, profile) {
  if (isAdminProfile(profile)) return true;
  const allowed = getAllowedSectorKeys(profile);
  if (!allowed.length) return false;

  const residentRaw = row?.residents || row?.resident || row;
  const resident = Array.isArray(residentRaw) ? residentRaw[0] : residentRaw;
  return allowed.some((key) => {
    const column = SECTOR_ACCESS[key].column;
    return resident?.[column] === true || resident?.[column] === 'true' || resident?.[column] === 1;
  });
}

export function buildSectorOrFilter(profile, prefix = '') {
  if (isAdminProfile(profile)) return '';
  const allowed = getAllowedSectorKeys(profile);
  if (!allowed.length) return null;
  return allowed.map((key) => `${prefix}${SECTOR_ACCESS[key].column}.eq.true`).join(',');
}

export function applyDirectSectorFilter(query, profile) {
  const filter = buildSectorOrFilter(profile);
  if (filter === '') return query;
  if (filter === null) return null;
  return query.or(filter);
}

export async function getAllowedResidentIds(db, profile) {
  if (isAdminProfile(profile)) return null;
  const query = applyDirectSectorFilter(
    db.from('residents').select('id'),
    profile,
  );
  if (!query) return [];

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => row.id).filter(Boolean);
}

export function forbiddenSectorResponse(NextResponse, message = 'Forbidden for assigned sector access.') {
  return NextResponse.json({ data: null, error: message }, { status: 403 });
}
