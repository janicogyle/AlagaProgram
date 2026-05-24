import {
  formatAssistanceControlNumber,
  formatBeneficiaryControlNumber,
  maxBeneficiarySequenceFromRows,
  nextAssistanceSequence,
} from '@/lib/controlNumbers';

/**
 * Generate the next assistance request control number.
 * Format: YYYY-### (sequence resets per calendar year, globally).
 */
export async function generateNextAssistanceControlNumber(db, assistanceType) {
  const type = String(assistanceType || '').trim();
  if (!type) {
    throw new Error('assistance_type is required to generate a control number.');
  }

  const year = new Date().getFullYear();
  const fallback = formatAssistanceControlNumber(year, 1);

  try {
    const { data, error } = await db
      .from('assistance_requests')
      .select('control_number')
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
 * Generate the next permanent beneficiary control number. Format: BENEF-###
 */
export async function generateNextBeneficiaryControlNumber(db) {
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
