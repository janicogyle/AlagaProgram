import { assistanceData } from './assistanceData';

const LOCAL_STORAGE_KEY = 'alaga-assistance-overrides';

const normalizeRequirements = (value) => {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean);
      }
    } catch {
      // fall through
    }
    return [trimmed];
  }
  return [];
};

const readLocalOverrides = () => {
  if (typeof window === 'undefined') return { budgets: {}, requirements: {} };
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { budgets: {}, requirements: {} };
    const parsed = JSON.parse(raw);
    return {
      budgets: parsed?.budgets || {},
      requirements: parsed?.requirements || {},
    };
  } catch {
    return { budgets: {}, requirements: {} };
  }
};

const writeLocalOverrides = (next) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
};

export const buildRequirementsMap = (rows = []) => {
  const map = {};
  rows.forEach((row) => {
    const key = row?.assistance_type;
    if (!key) return;
    if (!Object.prototype.hasOwnProperty.call(row, 'requirements')) return;
    const normalized = normalizeRequirements(row.requirements);
    if (normalized !== null) {
      map[key] = normalized;
    }
  });
  return map;
};

export const isMissingRequirementsColumn = (err) => {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('assistance_budgets') && msg.includes('requirements') && msg.includes('column');
};

export const getRequirementsForType = (type, overrides) => {
  if (!type) return [];
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, type)) {
    return overrides[type];
  }
  return assistanceData[type]?.requirements || [];
};

export const getLocalRequirementsMap = () => readLocalOverrides().requirements || {};

export const getLocalBudgetsMap = () => readLocalOverrides().budgets || {};

export const saveLocalRequirements = (type, requirements) => {
  if (!type) return;
  const current = readLocalOverrides();
  const next = {
    ...current,
    requirements: {
      ...(current.requirements || {}),
      [type]: requirements,
    },
  };
  writeLocalOverrides(next);
};

export const saveLocalBudget = (type, ceiling) => {
  if (!type) return;
  const current = readLocalOverrides();
  const next = {
    ...current,
    budgets: {
      ...(current.budgets || {}),
      [type]: ceiling,
    },
  };
  writeLocalOverrides(next);
};
