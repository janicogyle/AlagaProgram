export const ASSISTANCE_AMOUNT_CEILINGS = {
  'Medicine Assistance': 500,
  'Confinement Assistance': 1000,
  'Burial Assistance': 1000,
};

export function getAssistanceAmountCeiling(assistanceType) {
  const key = String(assistanceType || '').trim();
  const ceiling = ASSISTANCE_AMOUNT_CEILINGS[key];
  return typeof ceiling === 'number' ? ceiling : null;
}

export function resolveAssistanceAmount(assistanceType, amount) {
  const parsed = Number(amount);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return getAssistanceAmountCeiling(assistanceType) ?? 0;
}
