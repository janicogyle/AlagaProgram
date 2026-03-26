import { supabase } from '@/lib/supabaseClient';

// Helper to create or update a resident based on unique contact_number
// Expects a payload that already matches the `residents` table columns.
export async function createOrUpdateResident(resident) {
  if (!resident || !resident.contact_number) {
    throw new Error('contact_number is required to create or update a resident');
  }

  // Try to find an existing resident by contact number
  const { data: existing, error: lookupError } = await supabase
    .from('residents')
    .select('*')
    .eq('contact_number', resident.contact_number)
    .maybeSingle();

  if (lookupError && lookupError.code !== 'PGRST116') {
    // Non "no rows" error
    throw lookupError;
  }

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from('residents')
      .update(resident)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('residents')
    .insert(resident)
    .select()
    .single();

  if (insertError) throw insertError;
  return inserted;
}
