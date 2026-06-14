import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { requireStaffOrAdmin } from '@/lib/apiAuth';
import { createOrUpdateResident } from '@/lib/residents';
import {
  getAccountResubmissionSmsSetupError,
  sendAccountResubmissionSms,
  sendAccountStatusSms,
} from '@/lib/smsNotify.server';
import { generateNextBeneficiaryControlNumber } from '@/lib/controlNumbers.server';
import {
  getBeneficiaryCardsSetupHint,
  isMissingBeneficiaryCardsTable,
  issueBeneficiaryCard,
} from '@/lib/beneficiaryCards.server';
import { logStaffActivity } from '@/lib/activityLogger.server';
import {
  createAccountResubmissionCode,
  hashAccountResubmissionToken,
} from '@/lib/accountResubmissionTokens.server';

export const runtime = 'nodejs';

const LOCKED_CITIZENSHIP = 'Filipino';

function normalizeAccountRequestStatus(status) {
  if (status === 'Archived' || status === 'Rejected') return 'Incomplete';
  return status;
}

function getMissingAccountRequestsColumn(message) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(/Could not find the '([^']+)' column of 'account_requests' in the schema cache/i);
  if (match?.[1]) return match[1];

  // Postgres error surfaced via PostgREST
  match = msg.match(/column\s+account_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  match = msg.match(/column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"account_requests"\s+does\s+not\s+exist/i);
  if (match?.[1]) return match[1];

  return null;
}

async function fetchAccountRequestWithRetry(db, requestId) {
  const required = new Set([
    'id',
    'status',
    'first_name',
    'last_name',
    'contact_number',
    'house_no',
    'purok',
  ]);

  const columns = [
    'id',
    'status',
    'first_name',
    'middle_name',
    'last_name',
    'birthday',
    'age',
    'birthplace',
    'sex',
    'citizenship',
    'civil_status',
    'contact_number',
    'house_no',
    'purok',
    'street',
    'barangay',
    'city',
    'is_pwd',
    'is_senior_citizen',
    'is_solo_parent',
    'valid_id_url',
    'valid_id_urls',
    'notes',
    'processed_by',
    'processed_at',
    'created_at',
    'updated_at',
    'password_hash',
  ];

  let lastError = null;
  for (let attempt = 0; attempt < columns.length; attempt++) {
    const { data, error } = await db
      .from('account_requests')
      .select(columns.join(', '))
      .eq('id', requestId)
      .single();

    if (!error) return { data, error: null };

    lastError = error;

    if (error.code === 'PGRST116') {
      return { data: null, error };
    }

    const missing = getMissingAccountRequestsColumn(error.message);
    if (!missing) break;

    if (required.has(missing)) {
      const e = new Error(
        `Database is missing account_requests.${missing} (or schema cache is stale). ` +
          `Run the latest database schema script (database-schema.sql / setup-step4.sql) and then reload PostgREST:\n\n` +
          `NOTIFY pgrst, 'reload schema';`,
      );
      e.code = 'SCHEMA_MISSING_REQUIRED';
      throw e;
    }

    const idx = columns.indexOf(missing);
    if (idx === -1) break;
    columns.splice(idx, 1);
  }

  throw lastError;
}

function isBlank(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function mergeIfBlank(base, fallback, fields) {
  const merged = { ...(base || {}) };
  for (const f of fields) {
    if (isBlank(merged[f]) && !isBlank(fallback?.[f])) {
      merged[f] = fallback[f];
    }
  }
  return merged;
}

function parseValidIdUrls(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
    } catch {
      const single = value.trim();
      return single ? [single] : [];
    }
  }
  return [];
}

async function findResidentForSignupApproval(db, { requestId, contactNumber }) {
  let hasAccountRequestIdColumn = true;

  try {
    const { data, error } = await db
      .from('residents')
      .select('id, account_request_id, contact_number')
      .eq('account_request_id', requestId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return { resident: data, hasAccountRequestIdColumn };
  } catch (err) {
    const missing = String(err?.message || '').toLowerCase().includes('account_request_id');
    if (!missing) throw err;
    hasAccountRequestIdColumn = false;
  }

  if (!contactNumber) return { resident: null, hasAccountRequestIdColumn };

  const selectColumns = hasAccountRequestIdColumn ? 'id, account_request_id, contact_number' : 'id, contact_number';
  const { data, error } = await db
    .from('residents')
    .select(selectColumns)
    .eq('contact_number', contactNumber)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return { resident: data || null, hasAccountRequestIdColumn };
}

async function createAndSendResubmissionLink({
  db,
  request,
  requestId,
  accountRequest,
  processedBy,
  notes,
  markIncomplete = false,
}) {
  const smsSetupError = getAccountResubmissionSmsSetupError();
  if (smsSetupError) {
    const error = new Error(smsSetupError);
    error.code = 'RESUBMISSION_SMS_NOT_CONFIGURED';
    throw error;
  }

  const resubmissionCode = createAccountResubmissionCode();
  const now = new Date().toISOString();

  const updatePayload = {
    resubmission_token_hash: hashAccountResubmissionToken(resubmissionCode),
    resubmission_token_created_at: now,
  };

  if (markIncomplete) {
    updatePayload.status = 'Incomplete';
    updatePayload.processed_by = processedBy || 'Admin';
    updatePayload.processed_at = now;
    updatePayload.notes = notes || null;
  }

  const { data, error } = await db
    .from('account_requests')
    .update(updatePayload)
    .eq('id', requestId)
    .select('id, status, processed_by, processed_at, notes, resubmission_sent_at')
    .single();

  if (error) throw error;

  const sms = await sendAccountResubmissionSms({
    contactNumber: accountRequest?.contact_number,
    notes: data?.notes || notes || accountRequest?.notes,
    requestId,
    resubmissionCode,
  });

  let responseData = data;
  if (sms?.ok) {
    const { data: sentData, error: sentError } = await db
      .from('account_requests')
      .update({ resubmission_sent_at: now })
      .eq('id', requestId)
      .select('id, status, processed_by, processed_at, notes, resubmission_sent_at')
      .single();
    if (sentError) throw sentError;
    responseData = sentData;
  }

  return { data: responseData, sms };
}

export async function GET(request, { params }) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

    const db = supabaseAdmin ?? supabase;
    if (!db) {
      return NextResponse.json(
        { data: null, error: 'Server configuration error. Database client not available.' },
        { status: 500 },
      );
    }

    const { id: requestId } = await params;
    if (!requestId) {
      return NextResponse.json({ data: null, error: 'Request ID is required.' }, { status: 400 });
    }

    const { data: accountRequest, error: fetchError } = await fetchAccountRequestWithRetry(db, requestId);

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ data: null, error: 'Account request not found.' }, { status: 404 });
      }
      throw fetchError;
    }

    let merged = accountRequest;

    const normalizedStatus = normalizeAccountRequestStatus(accountRequest?.status);
    if (normalizedStatus === 'Approved') {
      try {
        const residentSelectWithLink = [
          'account_request_id',
          'birthday',
          'age',
          'birthplace',
          'sex',
          'citizenship',
          'civil_status',
          'house_no',
          'purok',
          'barangay',
          'city',
          'valid_id_url',
          'valid_id_urls',
        ].join(', ');

        const residentSelectNoLink = [
          'birthday',
          'age',
          'birthplace',
          'sex',
          'citizenship',
          'civil_status',
          'house_no',
          'purok',
          'barangay',
          'city',
          'valid_id_url',
          'valid_id_urls',
        ].join(', ');

        let resident = null;
        let hasLinkColumn = true;

        // Preferred linkage (if residents.account_request_id exists)
        try {
          const { data: byRequestId, error: linkErr } = await db
            .from('residents')
            .select(residentSelectWithLink)
            .eq('account_request_id', requestId)
            .limit(1)
            .maybeSingle();

          if (linkErr) throw linkErr;
          resident = byRequestId || null;
        } catch (e) {
          const missing = String(e?.message || '').toLowerCase().includes('account_request_id');
          if (!missing) throw e;
          hasLinkColumn = false;
        }

        // Fallback linkage for older schemas: match by contact_number
        if (!resident && accountRequest?.contact_number) {
          const { data: byContact } = await db
            .from('residents')
            .select(hasLinkColumn ? residentSelectWithLink : residentSelectNoLink)
            .eq('contact_number', accountRequest.contact_number)
            .limit(1)
            .maybeSingle();

          resident = byContact || null;
        }

        // Best-effort: link it for future lookups (only if link column exists)
        if (hasLinkColumn) {
          try {
            if (resident && !resident.account_request_id) {
              await db
                .from('residents')
                .update({ account_request_id: requestId })
                .eq('contact_number', accountRequest.contact_number);
            }
          } catch {
            // best-effort only
          }
        }

        merged = mergeIfBlank(merged, resident, [
          'birthday',
          'age',
          'birthplace',
          'sex',
          'citizenship',
          'civil_status',
          'house_no',
          'purok',
          'barangay',
          'city',
          'valid_id_url',
          'valid_id_urls',
        ]);

        // Best-effort: backfill missing signup fields from the resident profile so the modal shows complete info.
        try {
          const backfill = {};
          for (const f of [
            'birthday',
            'age',
            'birthplace',
            'sex',
            'citizenship',
            'civil_status',
            'house_no',
            'purok',
            'barangay',
            'city',
            'valid_id_url',
            'valid_id_urls',
          ]) {
            if (isBlank(accountRequest?.[f]) && !isBlank(resident?.[f])) backfill[f] = resident[f];
          }

          if (Object.keys(backfill).length) {
            await db.from('account_requests').update(backfill).eq('id', requestId);
          }
        } catch {
          // best-effort only
        }
      } catch {
        // If residents table/column is unavailable, do not fail the details view.
      }
    }

    return NextResponse.json({ data: merged, error: null });
  } catch (error) {
    console.error('Fetch account request error:', error);
    return NextResponse.json(
      { data: null, error: error?.message || 'Failed to fetch account request.' },
      { status: 500 },
    );
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await requireStaffOrAdmin(request);
    if (!auth.ok) return auth.response;

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
    const rawAction = String(action || '').trim().toLowerCase();

    if (!['approve', 'archive', 'reject', 'resend_resubmission'].includes(rawAction)) {
      return NextResponse.json(
        {
          data: null,
          error: 'Invalid action. Must be "approve", "reject", "archive", or "resend_resubmission".',
        },
        { status: 400 },
      );
    }

    const finalAction = rawAction === 'reject' ? 'archive' : rawAction;

    const { data: accountRequest, error: fetchError } = await fetchAccountRequestWithRetry(db, requestId);

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          {
            data: null,
            error: 'Account request not found.',
          },
          { status: 404 },
        );
      }
      throw fetchError;
    }

    const currentStatus = normalizeAccountRequestStatus(accountRequest.status);

    const requiresPending = finalAction === 'approve' || finalAction === 'archive';

    if (requiresPending && !['Pending', 'Resubmitted'].includes(currentStatus)) {
      return NextResponse.json(
        {
          data: null,
          error: `This request cannot be ${finalAction === 'archive' ? 'marked incomplete' : `${finalAction}d`} because it is ${String(currentStatus).toLowerCase()}.`,
        },
        { status: 409 },
      );
    }

    if (finalAction === 'resend_resubmission' && currentStatus !== 'Incomplete') {
      return NextResponse.json(
        {
          data: null,
          error: `Only incomplete requests can receive a resubmission SMS. Current status: ${currentStatus}.`,
        },
        { status: 409 },
      );
    }

    if (finalAction === 'approve') {
      let residentId = null;
      let issuedCard = null;

      try {
        const contactNumber = accountRequest.contact_number;
        const { resident: existingResident, hasAccountRequestIdColumn } = await findResidentForSignupApproval(db, {
          requestId,
          contactNumber,
        });

        if (existingResident?.id) {
          if (
            hasAccountRequestIdColumn &&
            existingResident.account_request_id &&
            existingResident.account_request_id === requestId
          ) {
            residentId = existingResident.id;
          } else {
            return NextResponse.json(
              { data: null, error: 'This contact number is already registered' },
              { status: 409 },
            );
          }
        }

        if (!residentId) {
          const controlNumber = await generateNextBeneficiaryControlNumber(db);
          const createdResident = await createOrUpdateResident({
            control_number: controlNumber,
            account_request_id: requestId,
            first_name: accountRequest.first_name,
            middle_name: accountRequest.middle_name,
            last_name: accountRequest.last_name,
            birthday: accountRequest.birthday,
            age: accountRequest.age,
            birthplace: accountRequest.birthplace,
            sex: accountRequest.sex,
            citizenship: LOCKED_CITIZENSHIP,
            civil_status: accountRequest.civil_status,
            contact_number: contactNumber,
            house_no: accountRequest.house_no,
            purok: accountRequest.purok,
            street: accountRequest.street,
            barangay: accountRequest.barangay || 'Sta. Rita',
            city: accountRequest.city || 'Olongapo City',
            valid_id_url: accountRequest.valid_id_url || parseValidIdUrls(accountRequest.valid_id_urls)[0] || null,
            is_pwd: accountRequest.is_pwd,
            is_senior_citizen: accountRequest.is_senior_citizen,
            is_solo_parent: accountRequest.is_solo_parent,
            status: 'Active',
            password_hash: accountRequest.password_hash || null,
          });

          residentId = createdResident?.id || null;
        }

        if (!residentId) {
          throw new Error('Resident account was created but its ID could not be resolved.');
        }
      } catch (residentError) {
        console.error('Failed to create resident:', residentError);

        const message = String(residentError?.message || 'Unknown error');
        if (message.toLowerCase().includes('duplicate key value violates unique constraint')) {
          return NextResponse.json(
            { data: null, error: 'This contact number is already registered' },
            { status: 409 },
          );
        }
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

      try {
        issuedCard = await issueBeneficiaryCard(db, residentId, { expiresInDays: 365 });
      } catch (cardError) {
        console.error('Failed to issue beneficiary QR card:', cardError);

        if (isMissingBeneficiaryCardsTable(cardError)) {
          return NextResponse.json(
            { data: null, error: getBeneficiaryCardsSetupHint(), code: 'BENEFICIARY_CARDS_TABLE_MISSING' },
            { status: 503 },
          );
        }

        if (cardError?.code === 'QR_CARD_SECRET_MISSING') {
          return NextResponse.json(
            { data: null, error: cardError.message, code: cardError.code },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            data: null,
            error: 'Failed to issue beneficiary QR card: ' + (cardError?.message || 'Unknown error'),
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

      const sms = await sendAccountStatusSms({
        contactNumber: accountRequest?.contact_number,
        status: data?.status || 'Approved',
        notes: accountRequest?.notes,
        requestId,
      });

      await logStaffActivity(
        auth,
        {
          action: 'Approved account request',
          message: 'Signup request approved and beneficiary account activated.',
          entity_type: 'account_request',
          entity_id: data?.id || requestId,
          reference_number: accountRequest?.contact_number || requestId,
          link: '/admin/account-requests',
          audience_resident_id: residentId || null,
        },
        db,
      );

      return NextResponse.json({ 
        data: {
          ...data,
          beneficiary_card: issuedCard?.card || null,
          beneficiary_card_token: issuedCard?.token || null,
        },
        error: null, 
        message: 'Account request approved and resident account created successfully.',
        sms,
      });
    } else if (finalAction === 'archive') {
      const result = await createAndSendResubmissionLink({
        db,
        request,
        requestId,
        accountRequest,
        processedBy,
        notes,
        markIncomplete: true,
      });

      await logStaffActivity(
        auth,
        {
          action: 'Marked account request incomplete',
          message: result.sms?.ok
            ? 'Signup request marked incomplete and resubmission code sent.'
            : 'Signup request marked incomplete and resubmission code generated, but SMS was not sent.',
          entity_type: 'account_request',
          entity_id: result.data?.id || requestId,
          reference_number: accountRequest?.contact_number || requestId,
          link: '/admin/account-requests',
        },
        db,
      );

      return NextResponse.json({
        data: result.data,
        error: null,
        message: 'Account request marked incomplete.',
        sms: result.sms,
      });
    } else if (finalAction === 'resend_resubmission') {
      const result = await createAndSendResubmissionLink({
        db,
        request,
        requestId,
        accountRequest,
        processedBy,
        notes: accountRequest?.notes,
        markIncomplete: false,
      });

      await logStaffActivity(
        auth,
        {
          action: 'Sent account request resubmission SMS',
          message: result.sms?.ok
            ? 'Resubmission code SMS sent for incomplete signup request.'
            : 'Resubmission code was generated, but SMS was not sent.',
          entity_type: 'account_request',
          entity_id: result.data?.id || requestId,
          reference_number: accountRequest?.contact_number || requestId,
          link: '/admin/account-requests',
        },
        db,
      );

      return NextResponse.json({
        data: result.data,
        error: null,
        message: 'Resubmission SMS processed.',
        sms: result.sms,
      });
    }
  } catch (error) {
    console.error('Process account request error:', error);
    if (error?.code === 'RESUBMISSION_SMS_NOT_CONFIGURED') {
      return NextResponse.json(
        {
          data: null,
          error: error.message || 'Resubmission SMS is not configured.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ 
      data: null, 
      error: error.message || 'Failed to process account request.' 
    }, { status: 500 });
  }
}
