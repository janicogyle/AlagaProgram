import { NextResponse } from 'next/server';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { supabaseAdmin } from '@/lib/supabaseClient';

const PROFILE_FIELDS =
  'id, control_number, first_name, middle_name, last_name, birthday, age, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, representative_name, representative_contact, representative_relationship, representative_valid_id_url, profile_photo_url, status';
const PROFILE_FIELDS_FALLBACK = PROFILE_FIELDS.replace(', profile_photo_url', '');

function isMissingProfilePhotoColumn(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('profile_photo_url') && message.includes('column');
}

export async function GET(request) {
  const session = readBeneficiarySession(request);
  if (!session.ok) {
    return NextResponse.json({ data: null, error: session.error || 'Unauthorized.' }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { data: null, error: 'Server configuration error. Database admin client not available.' },
      { status: 500 },
    );
  }

  let result = await supabaseAdmin
    .from('residents')
    .select(PROFILE_FIELDS)
    .eq('id', session.residentId)
    .maybeSingle();

  if (result.error && isMissingProfilePhotoColumn(result.error)) {
    result = await supabaseAdmin
      .from('residents')
      .select(PROFILE_FIELDS_FALLBACK)
      .eq('id', session.residentId)
      .maybeSingle();
  }

  if (result.error) {
    console.error('Fetch beneficiary profile error:', result.error);
    return NextResponse.json({ data: null, error: 'Unable to load beneficiary profile.' }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ data: null, error: 'Beneficiary profile not found.' }, { status: 404 });
  }

  const profile = {
    ...result.data,
    profile_photo_url: result.data.profile_photo_url ? '/api/beneficiary/profile-photo' : null,
  };

  return NextResponse.json(
    { data: profile, error: null },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}
