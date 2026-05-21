/**
 * One-time cleanup: empty legacy Supabase Storage document buckets.
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 *
 * Usage: node scripts/clear-supabase-storage.mjs
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

const BUCKETS = ['documents', 'document'];

async function listAllPaths(bucket, prefix = '') {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) {
    if (String(error.message || '').toLowerCase().includes('bucket')) return [];
    throw error;
  }

  const paths = [];
  for (const item of data || []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      const nested = await listAllPaths(bucket, fullPath);
      paths.push(...nested);
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

async function emptyBucket(bucket) {
  const paths = await listAllPaths(bucket);
  if (!paths.length) {
    console.log(`[${bucket}] already empty or missing`);
    return 0;
  }

  const chunkSize = 100;
  let removed = 0;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) throw error;
    removed += chunk.length;
  }

  console.log(`[${bucket}] removed ${removed} file(s)`);
  return removed;
}

let total = 0;
for (const bucket of BUCKETS) {
  try {
    total += await emptyBucket(bucket);
  } catch (e) {
    console.warn(`[${bucket}] skipped:`, e?.message || e);
  }
}

console.log(`Done. Removed ${total} object(s). Run setup-step7.sql in Supabase to drop policies and clear legacy DB paths.`);
