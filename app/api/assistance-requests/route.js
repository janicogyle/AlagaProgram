import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { getCooldownInfo } from '@/lib/requestCooldown';
import { filterCloudinaryUrls, validateCloudinaryDocumentUrls } from '@/lib/documentUrls.server';
import { generateNextAssistanceControlNumber } from '@/lib/controlNumbers.server';
import { logActivity, readOptionalStaffActor } from '@/lib/activityLogger.server';
import { RESTRICTED_BENEFICIARY_STATUSES } from '@/lib/beneficiaryIdStatus.server';

export const runtime = 'nodejs';

const isCheckedRequirement = (row) => {
  const value = row?.checked;
  return value === true || value === 'true' || value === 1 || value === '1';
};

const ALLOWED_REQUEST_SOURCES = new Set(['online', 'walk-in']);
const ACTIVE_ONLINE_STATUSES = ['Pending', 'Resubmitted'];
const REQUIREMENTS_VERIFICATION_COLUMNS = new Set([
  'requirements_checklist',
  'requirements_completed',
]);
const MISSING_REQUIREMENTS_VERIFICATION_CODE = 'MISSING_REQUIREMENTS_VERIFICATION_COLUMNS';
const MISSING_REQUIREMENTS_VERIFICATION_ERROR =
  'Database is missing requirements verification columns. Run setup-step10.sql in Supabase SQL Editor, then try again.';

function parsePositiveInt(value, fallback, { min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

const getFileNameFromUrl = (fileUrl) => {
  const raw = String(fileUrl || '').trim();
  if (!raw) return 'Document';
  const cleaned = raw.split('?')[0];
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Document';
};

const normalizeRequirementFiles = (value) => {
  if (!value) return [];

  let list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      // ignore
    }
  }

  return list
    .map((item) => {
      if (typeof item === 'string') {
        const fileUrl = item.trim();
        if (!fileUrl) return null;
        return {
          file_url: fileUrl,
          file_name: getFileNameFromUrl(fileUrl),
          requirement_type: null,
        };
      }

      if (!item || typeof item !== 'object') return null;

      const fileUrl = String(item.file_url || item.fileUrl || item.path || '').trim();
      if (!fileUrl) return null;

      const fileName = String(item.file_name || item.fileName || '').trim() || getFileNameFromUrl(fileUrl);
      const requirementTypeRaw = item.requirement_type ?? item.requirementType ?? null;
      const requirementType = requirementTypeRaw == null ? null : String(requirementTypeRaw).trim() || null;

      return {
        file_url: fileUrl,
        file_name: fileName,
        requirement_type: requirementType,
      };
    })
    .filter(Boolean);
};

const parsePathArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      const single = value.trim();
      return single ? [single] : [];
    }
  }
  return [];
};

function stripMissingAssistanceColumn(message, payload) {
  const msg = String(message || '');

  // PostgREST schema cache error
  let match = msg.match(
    /Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i,
  );

  // Postgres error surfaced via PostgREST
  if (!match) {
    match = msg.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
  }

  if (!match) {
    match = msg.match(
      /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?assistance_requests"\s+does\s+not\s+exist/i,
    );
  }

  if (!match) return { payload, removed: null };

  const col = match[1];
  if (!col) return { payload, removed: null };
  if (typeof payload !== 'object' || payload == null || !(col in payload)) {
    return { payload, removed: col };
  }

  const next = { ...payload };
  delete next[col];
  return { payload: next, removed: col };
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
    const statusParam = searchParams.get('status');
    const statusFilter = statusParam ? String(statusParam).trim() : '';
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const hasPagination = pageParam != null || pageSizeParam != null;
    const page = parsePositiveInt(pageParam, 1, { min: 1, max: 100000 });
    const pageSize = parsePositiveInt(pageSizeParam, 25, { min: 1, max: 100 });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const baseRequestFields = [
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
    ];

    const optionalRequestFields = [
      'requirements_urls',
      'requirements_completed',
      'requirements_checklist',
      'requirements_files',
      'request_source',
    ];

    const getMissingAssistanceColumn = (message) => {
      const msg = String(message || '');

      let match = msg.match(/Could not find the '([^']+)' column of 'assistance_requests' in the schema cache/i);
      if (match?.[1]) return match[1];

      match = msg.match(/column\s+(?:public\.)?assistance_requests\.([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i);
      if (match?.[1]) return match[1];

      match = msg.match(
        /column\s+"?([a-zA-Z0-9_]+)"?\s+of\s+relation\s+"(?:public\.)?assistance_requests"\s+does\s+not\s+exist/i,
      );
      if (match?.[1]) return match[1];

      return null;
    };

    const residentsJoin =
      'residents:resident_id(id, control_number, first_name, middle_name, last_name, birthday, birthplace, sex, citizenship, civil_status, contact_number, house_no, purok, street, barangay, city, representative_name, representative_contact, is_pwd, is_senior_citizen, is_solo_parent)';

    const runQuery = async (fields) => {
      let query = db
        .from('assistance_requests')
        .select([fields, residentsJoin].join(','), hasPagination ? { count: 'exact' } : undefined)
        .order('request_date', { ascending: false });

      if (residentId) {
        query = query.eq('resident_id', residentId);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      if (hasPagination) {
        query = query.range(from, to);
      }

      return await query;
    };

    // Try selecting optional columns (requirements_urls + requirements_completed), then gracefully fall back
    // when running against older schemas.
    let cols = [...baseRequestFields, ...optionalRequestFields];
    let data;
    let error;
    let count = null;

    for (let attempt = 0; attempt < optionalRequestFields.length + 1; attempt++) {
      ;({ data, error, count } = await runQuery(cols.join(',')));
      if (!error) break;

      const missing = getMissingAssistanceColumn(error.message);
      if (!missing || !optionalRequestFields.includes(missing)) break;

      cols = cols.filter((c) => c !== missing);
    }

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const enriched = rows.map((row) => {
      const reqFromColumn = parsePathArray(row?.requirements_urls);
      const reqFromLegacy = parsePathArray(row?.valid_id_url);
      let requirementUrls = reqFromColumn.length ? reqFromColumn : reqFromLegacy;

      return {
        ...row,
        requirements_urls: requirementUrls,
      };
    });

    return NextResponse.json({
      data: enriched,
      error: null,
      meta: hasPagination
        ? {
            page,
            pageSize,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / pageSize),
          }
        : undefined,
    });
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

    const requestSourceRaw = String(body.request_source || body.requestSource || 'online').trim().toLowerCase();
    const requestSource = ALLOWED_REQUEST_SOURCES.has(requestSourceRaw) ? requestSourceRaw : 'online';

    if (requestSource === 'online') {
      const { data: residentStatusRow, error: residentStatusError } = await db
        .from('residents')
        .select('id, status')
        .eq('id', residentId)
        .maybeSingle();

      if (residentStatusError) throw residentStatusError;

      if (RESTRICTED_BENEFICIARY_STATUSES.has(String(residentStatusRow?.status || ''))) {
        return NextResponse.json(
          {
            data: null,
            error: 'Your Beneficiary ID requires renewal before submitting new assistance requests.',
            code: 'BENEFICIARY_ID_RENEWAL_REQUIRED',
          },
          { status: 403 },
        );
      }

      const { data: activeRequest, error: activeRequestError } = await db
        .from('assistance_requests')
        .select('id, control_number, status, request_date, created_at')
        .eq('resident_id', residentId)
        .in('status', ACTIVE_ONLINE_STATUSES)
        .order('request_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeRequestError) {
        throw activeRequestError;
      }

      if (activeRequest) {
        return NextResponse.json(
          {
            data: null,
            error:
              'You already have a request under review. Please wait for the barangay office to finish reviewing it.',
            code: 'ACTIVE_REQUEST_EXISTS',
            activeRequest,
          },
          { status: 409 },
        );
      }
    }

    const { data: lastRequest, error: lastRequestError } = await db
      .from('assistance_requests')
      .select('request_date, created_at')
      .eq('resident_id', residentId)
      .eq('status', 'Released')
      .order('request_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRequestError) {
      throw lastRequestError;
    }

    const lastRequestDate = lastRequest?.request_date || lastRequest?.created_at || null;
    const cooldownInfo = getCooldownInfo(lastRequestDate);

    if (requestSource === 'online' && !cooldownInfo.isEligible) {
      return NextResponse.json(
        {
          data: null,
          error: `Please wait ${cooldownInfo.daysRemaining} day(s) before submitting another request. Next eligible on ${cooldownInfo.nextEligibleDate}.`,
          code: 'REQUEST_COOLDOWN',
          cooldown: cooldownInfo,
        },
        { status: 429 },
      );
    }

    const amount = Number(body.amount || 0);
    const requestDate = body.request_date || body.requestDate || new Date().toISOString().split('T')[0];

    const parseRequirements = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // ignore
        }
      }
      return null;
    };

    const requirementsUrls = parseRequirements(body.requirements_urls ?? body.requirementsUrls);
    const requirementsFilesInput = body.requirements_files ?? body.requirementsFiles;
    const requirementsFiles = normalizeRequirementFiles(requirementsFilesInput);
    const effectiveRequirementFiles = requirementsFiles.length
      ? requirementsFiles
      : (requirementsUrls || []).map((fileUrl) => ({
          file_url: fileUrl,
          file_name: getFileNameFromUrl(fileUrl),
          requirement_type: null,
        }));
    const allRequirementUrls = effectiveRequirementFiles.map((file) => file.file_url).filter(Boolean);
    const legacyValidIdUrl = body.valid_id_url || body.validIdUrl || null;

    const urlsToValidate = [...allRequirementUrls];
    if (legacyValidIdUrl && typeof legacyValidIdUrl === 'string' && legacyValidIdUrl.startsWith('http')) {
      urlsToValidate.push(legacyValidIdUrl);
    }
    if (urlsToValidate.length) {
      const docCheck = validateCloudinaryDocumentUrls(urlsToValidate, { label: 'Requirement file' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }

    const cloudinaryRequirementUrls = filterCloudinaryUrls(allRequirementUrls);
    const validIdUrl =
      legacyValidIdUrl ||
      (cloudinaryRequirementUrls.length > 1
        ? JSON.stringify(cloudinaryRequirementUrls)
        : cloudinaryRequirementUrls?.[0] ?? null);
    const parseChecklist = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // ignore
        }
      }
      return null;
    };

    const requirementsChecklist = parseChecklist(body.requirements_checklist ?? body.requirementsChecklist);

    const requirementsCompletedRaw = body.requirements_completed ?? body.requirementsCompleted;
    const legacyRequirementsCompleted =
      requirementsCompletedRaw === true || requirementsCompletedRaw === false ? requirementsCompletedRaw : null;
    const requirementsVerificationRequested =
      requirementsChecklist !== null ||
      Object.prototype.hasOwnProperty.call(body, 'requirements_checklist') ||
      Object.prototype.hasOwnProperty.call(body, 'requirementsChecklist') ||
      Object.prototype.hasOwnProperty.call(body, 'requirements_completed') ||
      Object.prototype.hasOwnProperty.call(body, 'requirementsCompleted');
    const requiredLabels = Array.isArray(requirementsChecklist)
      ? requirementsChecklist.map((row) => String(row?.label || '').trim()).filter(Boolean)
      : [];
    const limitedRequirementUrls = cloudinaryRequirementUrls;
    const limitedRequirementFiles = effectiveRequirementFiles
      .filter((file) => filterCloudinaryUrls([file.file_url]).length > 0);
    const hasRequiredFiles = requiredLabels.length
      ? requiredLabels.every((label, index) => (
          limitedRequirementFiles.some((file) => String(file.requirement_type || '').trim() === label) ||
          !!limitedRequirementUrls[index]
        ))
      : true;
    if (requestSource === 'online' && requiredLabels.length > 0 && !hasRequiredFiles) {
      return NextResponse.json(
        { data: null, error: 'Please upload at least one file for each required document.' },
        { status: 400 },
      );
    }
    const requirementsCompleted = requirementsChecklist?.length
      ? requirementsChecklist.every(isCheckedRequirement)
      : legacyRequirementsCompleted;

    const buildPayload = (controlNumber) => ({
      control_number: controlNumber,
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
      request_source: requestSource,
      valid_id_url:
        limitedRequirementUrls.length > 1 ? JSON.stringify(limitedRequirementUrls) : validIdUrl,
      ...(limitedRequirementUrls.length ? { requirements_urls: limitedRequirementUrls } : {}),
      ...(limitedRequirementFiles.length ? { requirements_files: limitedRequirementFiles } : {}),
      ...(requirementsChecklist ? { requirements_checklist: requirementsChecklist } : {}),
      ...(requirementsCompleted != null ? { requirements_completed: requirementsCompleted } : {}),
    });

    const selectFields =
      'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, request_source, processed_by, decision_remarks, valid_id_url, requirements_urls, requirements_files, requirements_checklist, requirements_completed, created_at';

    let data;
    let error;

    // Assign a new control number per assistance type (YYYY-###). Retry on rare conflicts.
    for (let attempt = 0; attempt < 5; attempt++) {
      const controlNumber = await generateNextAssistanceControlNumber(db, assistanceType);

      const attemptPayload = buildPayload(controlNumber);

      let insertPayload = { ...attemptPayload };
      let selectCols = selectFields.split(',').map((s) => s.trim()).filter(Boolean);

      for (let stripAttempt = 0; stripAttempt < 8; stripAttempt++) {
        ;({ data, error } = await db
          .from('assistance_requests')
          .insert(insertPayload)
          .select(selectCols.join(', '))
          .single());

        if (!error) break;

        // Backward compatibility: remove only the exact missing column
        // instead of dropping all requirement-related fields.
        const stripped = stripMissingAssistanceColumn(error.message, insertPayload);
        if (!stripped.removed) break;
        if (
          requirementsVerificationRequested &&
          REQUIREMENTS_VERIFICATION_COLUMNS.has(stripped.removed)
        ) {
          return NextResponse.json(
            {
              data: null,
              error: MISSING_REQUIREMENTS_VERIFICATION_ERROR,
              code: MISSING_REQUIREMENTS_VERIFICATION_CODE,
            },
            { status: 500 },
          );
        }

        insertPayload = stripped.payload;
        // If older schemas are missing multi-file columns, preserve all file paths in valid_id_url as JSON text.
        if (
          ['requirements_urls', 'requirements_files'].includes(stripped.removed) &&
          cloudinaryRequirementUrls.length > 1 &&
          typeof insertPayload.valid_id_url === 'string'
        ) {
          insertPayload.valid_id_url = JSON.stringify(cloudinaryRequirementUrls);
        }
        selectCols = selectCols.filter((c) => c !== stripped.removed);
      }

      if (!error) break;

      const msg = String(error?.message || '').toLowerCase();
      const isDuplicate = msg.includes('duplicate') && msg.includes('control_number');

      if (!isDuplicate) {
        break;
      }
    }

    if (error) throw error;

    const staffActor = await readOptionalStaffActor(request, supabaseAdmin);
    const actor = staffActor || {
      actor_resident_id: data?.resident_id || residentId || null,
      actor_name: data?.requester_name || data?.beneficiary_name || 'Beneficiary',
      actor_role: requestSource === 'walk-in' ? 'Staff' : 'Beneficiary',
    };
    const adminLink = '/admin/assistance/requests';
    const beneficiaryLink = '/beneficiary/history';

    await logActivity(
      {
        ...actor,
        action: 'Submitted assistance request',
        message: `${requestSource === 'walk-in' ? 'Walk-in' : 'Online'} assistance request submitted.`,
        entity_type: 'assistance_request',
        entity_id: data?.id || null,
        reference_number: data?.control_number || null,
        link: actor.actor_role === 'Beneficiary' ? beneficiaryLink : adminLink,
        audience_resident_id: data?.resident_id || residentId || null,
      },
      supabaseAdmin ?? db,
    );

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
