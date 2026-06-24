export const BENEFICIARY_SECTOR_KEYS = ['pwd', 'senior_citizen', 'solo_parent'];

export const BENEFICIARY_SECTOR_OPTIONS = [
  { value: 'pwd', label: 'PWD' },
  { value: 'senior_citizen', label: 'Senior Citizen' },
  { value: 'solo_parent', label: 'Solo Parent' },
];

export const SECTOR_FIELD_BY_KEY = {
  pwd: 'is_pwd',
  senior_citizen: 'is_senior_citizen',
  solo_parent: 'is_solo_parent',
};

export const SECTOR_FORM_FIELD_BY_KEY = {
  pwd: 'isPwd',
  senior_citizen: 'isSeniorCitizen',
  solo_parent: 'isSoloParent',
};

const LEGACY_PRIORITY = ['pwd', 'senior_citizen', 'solo_parent'];

export function normalizeBeneficiarySector(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'senior' || normalized === 'senior_citizen') return 'senior_citizen';
  if (normalized === 'solo' || normalized === 'solo_parent' || normalized === 'soloparent') return 'solo_parent';
  if (normalized === 'pwd') return 'pwd';
  return '';
}

export function getSectorLabel(value) {
  const key = normalizeBeneficiarySector(value);
  return BENEFICIARY_SECTOR_OPTIONS.find((option) => option.value === key)?.label || '';
}

export function selectedSectorKeysFromFlags(source = {}) {
  return LEGACY_PRIORITY.filter((key) => {
    const dbField = SECTOR_FIELD_BY_KEY[key];
    const formField = SECTOR_FORM_FIELD_BY_KEY[key];
    return !!(source?.[dbField] ?? source?.[formField]);
  });
}

export function buildSectorPairFromSource(source = {}) {
  const primary = normalizeBeneficiarySector(source.primary_sector ?? source.primarySector);
  const secondary = normalizeBeneficiarySector(source.secondary_sector ?? source.secondarySector);
  const selected = [];

  if (primary) selected.push(primary);
  if (secondary && secondary !== primary) selected.push(secondary);

  if (!selected.length) {
    selected.push(...selectedSectorKeysFromFlags(source).slice(0, 2));
  }

  return {
    primarySector: selected[0] || '',
    secondarySector: selected[1] || '',
  };
}

export function deriveSectorFlags(primarySector, secondarySector = '') {
  const selected = new Set(
    [normalizeBeneficiarySector(primarySector), normalizeBeneficiarySector(secondarySector)].filter(Boolean),
  );

  return {
    is_pwd: selected.has('pwd'),
    is_senior_citizen: selected.has('senior_citizen'),
    is_solo_parent: selected.has('solo_parent'),
  };
}

export function validateSectorPair(source = {}, { requirePrimary = true, allowLegacy = true } = {}) {
  const explicitPrimary = normalizeBeneficiarySector(source.primary_sector ?? source.primarySector);
  const explicitSecondary = normalizeBeneficiarySector(source.secondary_sector ?? source.secondarySector);
  const hasExplicitPair =
    Object.prototype.hasOwnProperty.call(source, 'primary_sector') ||
    Object.prototype.hasOwnProperty.call(source, 'primarySector') ||
    Object.prototype.hasOwnProperty.call(source, 'secondary_sector') ||
    Object.prototype.hasOwnProperty.call(source, 'secondarySector');

  let primarySector = explicitPrimary;
  let secondarySector = explicitSecondary;

  if (!primarySector && allowLegacy && !hasExplicitPair) {
    const legacy = selectedSectorKeysFromFlags(source);
    if (legacy.length > 2) {
      return {
        ok: false,
        error: 'A beneficiary can only have up to two sectors. Choose a Primary Sector and optional Secondary Sector.',
      };
    }
    primarySector = legacy[0] || '';
    secondarySector = legacy[1] || '';
  }

  if (requirePrimary && !primarySector) {
    return { ok: false, error: 'Primary Sector is required.' };
  }

  const invalid = [primarySector, secondarySector].filter((key) => key && !BENEFICIARY_SECTOR_KEYS.includes(key));
  if (invalid.length) {
    return { ok: false, error: 'Invalid sector classification.' };
  }

  if (primarySector && secondarySector && primarySector === secondarySector) {
    return { ok: false, error: 'Secondary Sector must be different from Primary Sector.' };
  }

  const selected = [primarySector, secondarySector].filter(Boolean);
  if (selected.length > 2 || new Set(selected).size !== selected.length) {
    return {
      ok: false,
      error: 'A beneficiary can only have up to two sectors.',
    };
  }

  return {
    ok: true,
    primarySector,
    secondarySector,
    flags: deriveSectorFlags(primarySector, secondarySector),
  };
}

export function getSecondarySectorOptions(primarySector) {
  const primary = normalizeBeneficiarySector(primarySector);
  return BENEFICIARY_SECTOR_OPTIONS.map((option) => ({
    ...option,
    disabled: !!primary && option.value === primary,
  }));
}
