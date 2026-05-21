/**
 * Migrate legacy resident control numbers (2026-001) to BENEF-001.
 * Usage: node scripts/migrate-beneficiary-control-numbers.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseBeneficiarySeq(value) {
  const raw = String(value || '').trim();
  const benef = raw.match(/^BENEF-(\d+)$/i);
  if (benef) return Number(benef[1]) || 0;
  const legacy = raw.match(/^(\d{4})-(\d+)$/);
  if (legacy) return Number(legacy[2]) || 0;
  return 0;
}

function formatBeneficiary(seq) {
  return `BENEF-${String(Math.max(1, seq)).padStart(3, '0')}`;
}

const { data: residents, error } = await supabase
  .from('residents')
  .select('id, control_number, created_at, first_name, last_name')
  .order('created_at', { ascending: true });

if (error) {
  console.error('Failed to load residents:', error.message);
  process.exit(1);
}

const rows = Array.isArray(residents) ? residents : [];
let maxBenef = 0;
for (const row of rows) {
  if (/^BENEF-\d+$/i.test(String(row.control_number || ''))) {
    maxBenef = Math.max(maxBenef, parseBeneficiarySeq(row.control_number));
  }
}

const legacy = rows.filter((row) => !/^BENEF-\d+$/i.test(String(row.control_number || '').trim()));

if (!legacy.length) {
  console.log('No legacy beneficiary control numbers to migrate.');
  process.exit(0);
}

let nextSeq = maxBenef;
const updates = [];

for (const row of legacy) {
  nextSeq += 1;
  const newNumber = formatBeneficiary(nextSeq);
  updates.push({ id: row.id, old: row.control_number, new: newNumber, name: `${row.first_name} ${row.last_name}` });
}

console.log(`Migrating ${updates.length} resident(s)...`);

for (const item of updates) {
  const { error: updateError } = await supabase
    .from('residents')
    .update({ control_number: item.new })
    .eq('id', item.id);

  if (updateError) {
    console.error(`Failed ${item.name}: ${updateError.message}`);
    process.exit(1);
  }

  console.log(`  ${item.old || '(empty)'} → ${item.new}  (${item.name})`);
}

console.log('Done. Refresh the Beneficiaries page.');
