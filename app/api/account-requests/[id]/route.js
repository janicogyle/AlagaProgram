import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { createOrUpdateResident } from '@/lib/residents';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: requestId } = await params;

    if (!requestId) {
      return NextResponse.json({ 
        data: null, 
        error: 'Request ID is required.' 
      }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ 
        data: null, 
        error: 'Invalid request body.' 
      }, { status: 400 });
    }

    const { action, processedBy, notes } = body;
    const normalizedAction = action === 'reject' ? 'archive' : action;

    if (!normalizedAction || !['approve', 'archive', 'unarchive'].includes(normalizedAction)) {
      return NextResponse.json(
        {
          data: null,
          error: 'Invalid action. Must be "approve", "archive", or "unarchive".',
        },
        { status: 400 },
      );
    }

    const { data: accountRequest, error: fetchError } = await db
      .from('account_requests')
      .select(
        'id, status, first_name, middle_name, last_name, birthday, contact_number, house_no, purok, street, barangay, city, is_pwd, is_senior_citizen, is_solo_parent, password_hash',
      )
      .eq('id', requestId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ 
          data: null, 
          error: 'Account request not found.' 
        }, { status: 404 });
      }
      throw fetchError;
    }

    const currentStatus = accountRequest.status === 'Rejected' ? 'Archived' : accountRequest.status;

    const requiresPending = normalizedAction === 'approve' || normalizedAction === 'archive';
    const requiresArchived = normalizedAction === 'unarchive';

    if (requiresPending && currentStatus !== 'Pending') {
      return NextResponse.json(
        {
          data: null,
          error: `This request cannot be ${normalizedAction}d because it is ${String(currentStatus).toLowerCase()}.`,
        },
        { status: 409 },
      );
    }

    if (requiresArchived && currentStatus !== 'Archived') {
      return NextResponse.json(
        {
          data: null,
          error: `Only archived requests can be unarchived. Current status: ${currentStatus}.`,
        },
        { status: 409 },
      );
    }

    if (normalizedAction === 'approve') {
      try {
        // Generate control number for the new resident
        const controlNumber = `RES-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        await createOrUpdateResident({
          control_number: controlNumber,
          first_name: accountRequest.first_name,
          middle_name: accountRequest.middle_name,
          last_name: accountRequest.last_name,
          birthday: accountRequest.birthday,
          contact_number: accountRequest.contact_number,
          house_no: accountRequest.house_no,
          purok: accountRequest.purok,
          street: accountRequest.street,
          barangay: accountRequest.barangay || 'Sta. Rita',
          city: accountRequest.city || 'Olongapo City',
          is_pwd: accountRequest.is_pwd,
          is_senior_citizen: accountRequest.is_senior_citizen,
          is_solo_parent: accountRequest.is_solo_parent,
          status: 'Active',
          password_hash: accountRequest.password_hash || null,
        });
      } catch (residentError) {
        console.error('Failed to create resident:', residentError);

        const message = String(residentError?.message || 'Unknown error');
        if (
          message.includes("password_hash") &&
          message.includes("residents") &&
          message.includes("schema cache")
        ) {
          return NextResponse.json(
            {
              data: null,
              error:
                "Database is missing residents.password_hash. Run in Supabase SQL Editor:\n\n" +
                "ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS password_hash text;\n" +
                "NOTIFY pgrst, 'reload schema';",
            },
            { status: 500 },
          );
        }

        const missingResidentsColumnMatch = message.match(
          /Could not find the '([^']+)' column of 'residents' in the schema cache/i,
        );
        if (missingResidentsColumnMatch) {
          const col = missingResidentsColumnMatch[1];
          const isSafeIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col);
          return NextResponse.json(
            {
              data: null,
              error:
                `Database is missing residents.${col}. Run in Supabase SQL Editor:\n\n` +
                (isSafeIdent
                  ? `ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS ${col} text;\n`
                  : "ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS <column_name> text;\n") +
                "NOTIFY pgrst, 'reload schema';",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            data: null,
            error: 'Failed to create resident account: ' + message,
          },
          { status: 500 },
        );
      }

      const { data, error } = await db
        .from('account_requests')
        .update({
          status: 'Approved',
          processed_by: processedBy || 'Admin',
          processed_at: new Date().toISOString(),
          password_hash: null,
        })
        .eq('id', requestId)
        .select('id, status, processed_by, processed_at')
        .single();

      if (error) throw error;

      return NextResponse.json({ 
        data, 
        error: null, 
        message: 'Account request approved and resident account created successfully.' 
      });
    } else if (normalizedAction === 'archive') {
      const { data, error } = await db
        .from('account_requests')
        .update({
          status: 'Archived',
          processed_by: processedBy || 'Admin',
          processed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', requestId)
        .select('id, status, processed_by, processed_at, notes')
        .single();

      if (error) throw error;

      return NextResponse.json({
        data,
        error: null,
        message: 'Account request archived.',
      });
    } else if (normalizedAction === 'unarchive') {
      const { data, error } = await db
        .from('account_requests')
        .update({
          status: 'Pending',
          processed_by: null,
          processed_at: null,
          notes: notes || null,
        })
        .eq('id', requestId)
        .select('id, status, processed_by, processed_at, notes')
        .single();

      if (error) throw error;

      return NextResponse.json({
        data,
        error: null,
        message: 'Account request unarchived.',
      });
    }
  } catch (error) {
    console.error('Process account request error:', error);
    return NextResponse.json({ 
      data: null, 
      error: error.message || 'Failed to process account request.' 
    }, { status: 500 });
  }
}
