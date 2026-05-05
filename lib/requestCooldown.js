const COOLDOWN_MONTHS = 3;
const ALMOST_ELIGIBLE_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const toDateOnlyString = (value) => {
  if (!isValidDate(value)) return null;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value) => {
  if (!value) return null;
  if (isValidDate(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!Number.isNaN(year) && !Number.isNaN(month) && !Number.isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(raw);
  return isValidDate(parsed) ? parsed : null;
};

const addMonths = (value, months) => {
  const date = parseDateInput(value);
  if (!date) return null;
  const day = date.getDate();
  const target = new Date(date);
  target.setMonth(target.getMonth() + months);
  if (target.getDate() !== day) {
    target.setDate(0);
  }
  return target;
};

const getCooldownInfo = (lastRequestDate, now = new Date()) => {
  const parsed = parseDateInput(lastRequestDate);
  if (!parsed) {
    return {
      status: 'Eligible',
      isEligible: true,
      daysRemaining: 0,
      nextEligibleDate: null,
      lastRequestDate: null,
    };
  }

  const nextEligible = addMonths(parsed, COOLDOWN_MONTHS);
  if (!nextEligible) {
    return {
      status: 'Eligible',
      isEligible: true,
      daysRemaining: 0,
      nextEligibleDate: null,
      lastRequestDate: toDateOnlyString(parsed),
    };
  }

  const diffMs = nextEligible.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / MS_PER_DAY);
  const safeDays = Math.max(0, daysRemaining);

  let status = 'Eligible';
  if (safeDays > 0 && safeDays <= ALMOST_ELIGIBLE_DAYS) {
    status = 'Almost Eligible';
  } else if (safeDays > ALMOST_ELIGIBLE_DAYS) {
    status = 'Not Yet Eligible';
  }

  return {
    status,
    isEligible: safeDays <= 0,
    daysRemaining: safeDays,
    nextEligibleDate: toDateOnlyString(nextEligible),
    lastRequestDate: toDateOnlyString(parsed),
  };
};

export { COOLDOWN_MONTHS, ALMOST_ELIGIBLE_DAYS, parseDateInput, getCooldownInfo };
