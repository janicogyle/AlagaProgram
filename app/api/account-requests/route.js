import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { hashPassword } from '@/lib/passwords.server';

export const runtime = 'nodejs';

function normalizeContactNumber(input) {
  const digits = String(input || '').replace(/\D/g, '');

  // +63xxxxxxxxxx or 63xxxxxxxxxx
  if (digits.length === 12 && digits.startsWith('63')) {
    return `0${digits.slice(2)}`;
  }

  // xxxxxxxxxx (10 digits) -> 0xxxxxxxxxx
  if (digits.length === 10) {
    return `0${digits}`;
  }

  // If extra digits, keep the most likely PH mobile (last 11)
  if (digits.length > 11) {
    return digits.slice(-11);
  }

  return digits;
}

export async function GET() {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        {
          data: null,
          error: 'Server configuration error. Database client not available.',
        },
        { status: 500 },
      );
    }

    const { data, error } = await db
      .from('account_requests')
      .select(
        'id, first_name, middle_name, last_name, birthday, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, status, notes, processed_by, processed_at, created_at, updated_at',
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Fetch account requests error:', error);
    return NextResponse.json({ data: null, error: error.message || 'Failed to fetch account requests.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        {
          data: null,
          error: 'Server configuration error. Database client not available.',
        },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const contactNumber = normalizeContactNumber(body.contactNumber);
    const password = body.password;

    if (!body.firstName || !body.lastName || !body.birthday || !contactNumber || !body.houseNo || !body.purok || !body.street) {
      return NextResponse.json({ data: null, error: 'Missing required fields.' }, { status: 400 });
    }

    if (contactNumber.length !== 11) {
      return NextResponse.json({ data: null, error: 'Contact number must be 11 digits.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const { data, error } = await db
      .from('account_requests')
      .insert({
        first_name: body.firstName,
        middle_name: body.middleName || null,
        last_name: body.lastName,
        birthday: body.birthday,
        contact_number: contactNumber,
        house_no: body.houseNo,
        purok: body.purok,
        street: body.street,
        barangay: body.barangay || 'Sta. Rita',
        city: body.city || 'Olongapo City',
        is_pwd: !!body.isPwd,
        is_senior_citizen: !!body.isSeniorCitizen,
        is_solo_parent: !!body.isSoloParent,
        status: 'Pending',
        password_hash: passwordHash,
      })
      .select('id, status, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('Create account request error:', error);
    return NextResponse.json({ data: null, error: error.message || 'Failed to create account request.' }, { status: 500 });
  }
}
