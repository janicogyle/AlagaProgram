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

    const requestFields = [
      'id',
      'control_number',
      'resident_id',
      'requester_name',
      'requester_contact',
      'requester_address',
      'beneficiary_name',
      'beneficiary_contact',
      'beneficiary_address',
      'assistance_type',
      'amount',
      'status',
      'request_date',
      'processed_by',
      'decision_remarks',
      'valid_id_url',
      'created_at',
    ].join(',');

    let query = db
      .from('assistance_requests')
      .select(
        [
          requestFields,
          'residents:resident_id(id, control_number, first_name, middle_name, last_name, birthday, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, representative_name, representative_contact, is_pwd, is_senior_citizen, is_solo_parent)',
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
      .select(
        'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, processed_by, decision_remarks, valid_id_url, created_at',
      )
      .single();

    if (error) throw error;

    // Best-effort: notify all active Admin/Staff of the new request.
    if (supabaseAdmin) {
      try {
        const { data: recipients } = await supabaseAdmin
          .from('users')
          .select('id, role, status')
          .in('role', ['Admin', 'Staff'])
          .eq('status', 'Active');

        if (recipients?.length) {
          const rows = recipients.map((u) => ({
            user_id: u.id,
            title: 'New assistance request',
            message: `Reference: ${data.control_number}${data.requester_name ? ` • Requester: ${data.requester_name}` : ''}`,
            type: 'info',
            link: '/admin/assistance/requests',
          }));
          await supabaseAdmin.from('notifications').insert(rows);
        }
      } catch (notifyError) {
        console.warn('Unable to create notifications for assistance request:', notifyError);
      }
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    console.error('Create assistance request error:', error);
    return NextResponse.json(
      { data: null, error: error.message || 'Failed to create assistance request.' },
      { status: 500 },
    );
  }
}
