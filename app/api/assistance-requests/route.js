import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function generateControlNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0');
  return `AST-${year}-${random}`;
}

export async function GET(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const residentId = searchParams.get('residentId');

    let query = db
      .from('assistance_requests')
      .select(
        [
          '*',
          'residents:resident_id(id, first_name, middle_name, last_name, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent)',
        ].join(','),
      )
      .order('request_date', { ascending: false });

    if (residentId) {
      query = query.eq('resident_id', residentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [], error: null });
  } catch (error) {
    console.error('Fetch assistance requests error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to fetch assistance requests.' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: 'Invalid request body.' }, { status: 400 });
    }

    const residentId = body.resident_id || body.residentId;
    if (!residentId) {
      return NextResponse.json({ data: null, error: 'resident_id is required.' }, { status: 400 });
    }

    const assistanceType = body.assistance_type || body.assistanceType;
    if (!assistanceType) {
      return NextResponse.json({ data: null, error: 'assistance_type is required.' }, { status: 400 });
    }

    const amount = Number(body.amount || 0);
    const requestDate = body.request_date || body.requestDate || new Date().toISOString().split('T')[0];

    const payload = {
      control_number: body.control_number || body.controlNumber || generateControlNumber(),
      resident_id: residentId,
      requester_name: body.requester_name || body.requesterName || null,
      requester_contact: body.requester_contact || body.requesterContact || null,
      requester_address: body.requester_address || body.requesterAddress || null,
      beneficiary_name: body.beneficiary_name || body.beneficiaryName || null,
      beneficiary_contact: body.beneficiary_contact || body.beneficiaryContact || null,
      beneficiary_address: body.beneficiary_address || body.beneficiaryAddress || null,
      assistance_type: assistanceType,
      amount: Number.isFinite(amount) ? amount : 0,
      status: body.status || 'Pending',
      request_date: requestDate,
      valid_id_url: body.valid_id_url || body.validIdUrl || null,
    };

    const { data, error } = await db
      .from('assistance_requests')
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    console.error('Create assistance request error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to create assistance request.' },
      { status: 500 },
    );
  }
}
