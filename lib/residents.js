import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

function stripMissingResidentsColumn(message, payload) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(/Could not find the '([^']+)' column of 'residents' in the schema cache/i);

  // Postgres error surfaced via PostgREST
  if (!match) {
    match = msg.match(/column\s+(?:public\.)?residents\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  }

  if (!match) {
    match = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?residents"\s+does\s+not\s+exist/i);
  }

  if (!match) return { payload, removed: null };

  const col = match[1];
  if (!col || typeof payload !== 'object' || payload == null) return { payload, removed: null };

  // Never strip password_hash silently; login depends on it.
  if (col === 'password_hash') return { payload, removed: null };

  if (!(col in payload)) return { payload, removed: null };

  const next = { ...payload };
  delete next[col];
  return { payload: next, removed: col };
}

async function updateWithRetry(db, id, resident) {
  let payload = resident;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from('residents')
      .update(payload)
      .eq('id', id)
      .select('id')
      .single();

    if (!error) return data;

    const stripped = stripMissingResidentsColumn(error.message, payload);
    if (!stripped.removed) {
      throw new Error(`Failed to update resident: ${error.message}`);
    }

    console.warn(
      `[residents] Column missing in schema cache: ${stripped.removed}. Retrying without it.`,
    );
    payload = stripped.payload;
  }

  throw new Error('Failed to update resident: too many retries');
}

async function insertWithRetry(db, resident) {
  let payload = resident;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db.from('residents').insert(payload).select('id').single();

    if (!error) return data;

    const stripped = stripMissingResidentsColumn(error.message, payload);
    if (!stripped.removed) {
      throw new Error(`Failed to create resident: ${error.message}`);
    }

    console.warn(
      `[residents] Column missing in schema cache: ${stripped.removed}. Retrying without it.`,
    );
    payload = stripped.payload;
  }

  throw new Error('Failed to create resident: too many retries');
}

// Helper to create or update a resident based on unique contact_number
// Expects a payload that already matches the `residents` table columns.
export async function createOrUpdateResident(resident) {
  const db = supabaseAdmin ?? supabase;
  if (!db) {
    throw new Error('Supabase client not initialized');
  }

  if (!resident) {
    throw new Error('resident payload is required');
  }

  // Validate required fields
  if (!resident.first_name || !resident.last_name) {
    throw new Error('first_name and last_name are required');
  }

  try {
    // If an explicit ID is provided, update that resident directly.
    // This avoids accidentally creating a new resident when contact_number changes.
    if (resident.id) {
      const { id, ...payload } = resident;
      return await updateWithRetry(db, id, payload);
    }

    if (!resident.contact_number) {
      throw new Error('contact_number is required to create or update a resident');
    }

    // Try to find an existing resident by contact number
    const { data: existing, error: lookupError } = await db
      .from('residents')
      .select('id')
      .eq('contact_number', resident.contact_number)
      .maybeSingle();

    if (lookupError && lookupError.code !== 'PGRST116') {
      // Non "no rows" error
      throw new Error(`Failed to lookup resident: ${lookupError.message}`);
    }

    if (existing) {
      return await updateWithRetry(db, existing.id, resident);
    }

    return await insertWithRetry(db, resident);
  } catch (error) {
    // Re-throw with context if not already an Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error in createOrUpdateResident: ${String(error)}`);
  }
}
