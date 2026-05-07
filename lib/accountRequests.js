import { supabase } from './supabaseClient';
import { createOrUpdateResident } from './residents';

// Get all account requests
export async function getAllAccountRequests() {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') };
  }

  try {
    const { data, error } = await supabase
      .from('account_requests')
      .select(
        'id, status, first_name, middle_name, last_name, birthday, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, processed_by, processed_at, notes, created_at',
      )
      .order('created_at', { ascending: false });

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

// Approve account request
export async function approveAccountRequest(requestId, processedBy) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') };
  }

  if (!requestId) {
    return { data: null, error: new Error('Request ID is required') };
  }

  try {
    // Get the request details
    const { data: request, error: fetchError } = await supabase
      .from('account_requests')
      .select(
        'id, status, first_name, middle_name, last_name, birthday, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent',
      )
      .eq('id', requestId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return { data: null, error: new Error('Account request not found') };
      }
      throw fetchError;
    }

    if (request.status !== 'Pending') {
      return { data: null, error: new Error(`This request has already been ${request.status.toLowerCase()}`) };
    }

    // Enforce uniqueness: contact number cannot be used more than once
    const { data: existingResident, error: residentLookupError } = await supabase
      .from('residents')
      .select('id')
      .eq('contact_number', request.contact_number)
      .limit(1)
      .maybeSingle();

    if (residentLookupError && residentLookupError.code !== 'PGRST116') {
      throw residentLookupError;
    }

    if (existingResident) {
      return { data: null, error: new Error('This contact number is already registered and cannot be used again.') };
    }

    // Create resident from account request
    const residentData = await createOrUpdateResident({
      first_name: request.first_name,
      middle_name: request.middle_name,
      last_name: request.last_name,
      birthday: request.birthday,
      contact_number: request.contact_number,
      house_no: request.house_no,
      purok: request.purok,
      street: request.street,
      barangay: request.barangay,
      city: request.city,
      is_pwd: request.is_pwd,
      is_senior_citizen: request.is_senior_citizen,
      is_solo_parent: request.is_solo_parent,
      status: 'Active',
    });

    // Update request status
    const { data, error } = await supabase
      .from('account_requests')
      .update({
        status: 'Approved',
        processed_by: processedBy || 'Admin',
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null, resident: residentData };
  } catch (error) {
    return { data: null, error };
  }
}

// Reject account request
export async function rejectAccountRequest(requestId, processedBy, notes) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not initialized') };
  }

  if (!requestId) {
    return { data: null, error: new Error('Request ID is required') };
  }

  try {
    const { data, error } = await supabase
      .from('account_requests')
      .update({
        status: 'Archived',
        processed_by: processedBy || 'Admin',
        processed_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', requestId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}
