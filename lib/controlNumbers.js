export const BENEFICIARY_CONTROL_PREFIX = 'BENEF-';
export const ASSISTANCE_CONTROL_PAD = 3;
export const BENEFICIARY_CONTROL_PAD = 3;

export function formatAssistanceControlNumber(year, seq) {
  const safeYear = Number(year) || new Date().getFullYear();
  const safeSeq = Number(seq) || 1;
  return `${safeYear}-${String(Math.max(1, safeSeq)).padStart(ASSISTANCE_CONTROL_PAD, '0')}`;
}

export function formatBeneficiaryControlNumber(seq) {
  const safeSeq = Number(seq) || 1;
  return `${BENEFICIARY_CONTROL_PREFIX}${String(Math.max(1, safeSeq)).padStart(BENEFICIARY_CONTROL_PAD, '0')}`;
}

export function parseAssistanceControlNumber(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d+)$/);
  if (!match) return { year: 0, seq: 0, raw };
  return { year: Number(match[1]) || 0, seq: Number(match[2]) || 0, raw };
}

export function parseBeneficiaryControlNumber(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^BENEF-(\d+)$/i);
  if (!match) return { seq: 0, raw };
  return { seq: Number(match[1]) || 0, raw };
}

export function nextAssistanceSequence(lastControlNumber, year) {
  const safeYear = Number(year) || new Date().getFullYear();
  const last = String(lastControlNumber || '').trim();
  const match = last.match(new RegExp(`^${safeYear}-(\\d+)$`));
  const nextSeq = match ? Number(match[1]) + 1 : 1;
  return Number.isFinite(nextSeq) && nextSeq > 0 ? nextSeq : 1;
}

export function parseBeneficiarySequence(value) {
  const raw = String(value || '').trim();
  const benef = raw.match(/^BENEF-(\d+)$/i);
  if (benef) return Number(benef[1]) || 0;
  // Legacy residents used YYYY-### before BENEF-### migration
  const legacy = raw.match(/^(\d{4})-(\d+)$/);
  if (legacy) return Number(legacy[2]) || 0;
  return 0;
}

export function nextBeneficiarySequence(lastControlNumber) {
  const seq = parseBeneficiarySequence(lastControlNumber);
  const nextSeq = seq > 0 ? seq + 1 : 1;
  return Number.isFinite(nextSeq) && nextSeq > 0 ? nextSeq : 1;
}

export function maxBeneficiarySequenceFromRows(rows) {
  let maxSeq = 0;
  for (const row of rows || []) {
    maxSeq = Math.max(maxSeq, parseBeneficiarySequence(row?.control_number));
  }
  return maxSeq;
}

/**
 * Preview/query the next assistance control number for a given assistance type.
 */
export async function queryNextAssistanceControlNumber(db, assistanceType) {
  const type = String(assistanceType || '').trim();
  if (!type || !db) {
    return formatAssistanceControlNumber(new Date().getFullYear(), 1);
  }

  const year = new Date().getFullYear();
  const fallback = formatAssistanceControlNumber(year, 1);

  try {
    const { data, error } = await db
      .from('assistance_requests')
      .select('control_number')
      .eq('assistance_type', type)
      .like('control_number', `${year}-%`)
      .order('control_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const seq = nextAssistanceSequence(data?.control_number, year);
    return formatAssistanceControlNumber(year, seq);
  } catch (err) {
    console.warn('[controlNumbers] Failed to compute next assistance control number:', err);
    return fallback;
  }
}

/**
 * Preview/query the next permanent beneficiary control number (BENEF-###).
 */
export async function queryNextBeneficiaryControlNumber(db) {
  if (!db) return formatBeneficiaryControlNumber(1);

  const fallback = formatBeneficiaryControlNumber(1);

  try {
    const { data, error } = await db.from('residents').select('control_number');

    if (error) throw error;

    const maxSeq = maxBeneficiarySequenceFromRows(data);
    return formatBeneficiaryControlNumber(maxSeq + 1);
  } catch (err) {
    console.warn('[controlNumbers] Failed to compute next beneficiary control number:', err);
    return fallback;
  }
}

export function parseControlNumberForSort(value) {
  const benef = parseBeneficiaryControlNumber(value);
  if (benef.seq > 0) {
    return { kind: 'beneficiary', year: 0, seq: benef.seq, raw: benef.raw };
  }

  const assist = parseAssistanceControlNumber(value);
  if (assist.seq > 0) {
    return { kind: 'assistance', year: assist.year, seq: assist.seq, raw: assist.raw };
  }

  return { kind: 'other', year: 0, seq: 0, raw: String(value || '').trim() };
}
