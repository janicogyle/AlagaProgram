const stripToDigits = (input) => String(input || '').replace(/\D/g, '');

export const PH_CONTACT_PREFIX = '+63';
export const PH_CONTACT_PLACEHOLDER = '+63 xxx xxx xxxx';

export function normalizePhContactNumber(input) {
  const digits = stripToDigits(input);
  if (!digits) return '';
  if (digits === '63' || digits === '6') return '';

  let local = digits;
  if (local.startsWith('63')) {
    local = local.slice(2);
  } else if (local.startsWith('0')) {
    local = local.slice(1);
  }

  local = local.replace(/^0+/, '');
  local = local.slice(0, 10);

  if (!local) return '';

  return `0${local}`;
}

export function formatPhContactNumber(input) {
  const digits = stripToDigits(input);
  if (!digits) return '';

  let local = digits;
  if (local.startsWith('63')) {
    local = local.slice(2);
  } else if (local.startsWith('0')) {
    local = local.slice(1);
  }

  local = local.slice(0, 10);

  let formatted = '+63';
  if (!local) return formatted;

  const part1 = local.slice(0, 3);
  const part2 = local.slice(3, 6);
  const part3 = local.slice(6, 10);

  formatted += ` ${part1}`;
  if (part2) formatted += ` ${part2}`;
  if (part3) formatted += ` ${part3}`;

  return formatted;
}
