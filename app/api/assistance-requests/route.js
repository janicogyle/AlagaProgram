import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { getCooldownInfo } from '@/lib/requestCooldown';

export const runtime = 'nodejs';

const isCheckedRequirement = (row) => {
  const value = row?.checked;
  return value === true || value === 'true' || value === 1 || value === '1';
};

const ALLOWED_REQUEST_SOURCES = new Set(['online', 'walk-in']);

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

const parseArrayValue = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [];
};

const listRequirementPathsFromStorage = async (controlNumber, limitCount = 0) => {
  const folder = `assistance-requests/${String(controlNumber || '').trim()}`;
  if (!folder || folder.endsWith('/')) return [];

  if (!supabaseAdmin) return [];
  const bucketsToTry = ['document', 'documents'];

  for (const bucket of bucketsToTry) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, { limit: 200 });
    if (error) continue;
    const sorted = (data || [])
      .filter((item) => !item?.id?.endsWith('/') && !!item?.name)
      .sort((a, b) => {
        const aTime = Date.parse(String(a?.created_at || '')) || 0;
        const bTime = Date.parse(String(b?.created_at || '')) || 0;
        return bTime - aTime;
      });
    const trimmed = limitCount > 0 ? sorted.slice(0, limitCount) : sorted;
    const paths = trimmed.map((item) => `${folder}/${item.name}`);
    if (paths.length) return paths;
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
  if (!col || typeof payload !== 'object' || payload == null) return { payload, removed: null };
  if (!(col in payload)) return { payload, removed: null };

  const next = { ...payload };
  delete next[col];
  return { payload: next, removed: col };
}

async function generateNextControlNumber(db) {
  const year = new Date().getFullYear();
  const fallback = `${year}-001`;

  try {
    const { data, error } = await db
      .from('assistance_requests')
      .select('control_number')
      .like('control_number', `${year}-%`)
      .order('control_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const last = String(data?.control_number || '').trim();
    const match = last.match(new RegExp(`^${year}-(\\d{3})$`));
    const nextSeq = match ? Number(match[1]) + 1 : 1;

    if (!Number.isFinite(nextSeq) || nextSeq < 1) return fallback;

    return `${year}-${String(nextSeq).padStart(3, '0')}`;
  } catch (err) {
    console.warn('[assistance-requests] Failed to compute next control number:', err);
    return fallback;
  }
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
        .select([fields, residentsJoin].join(','))
        .order('request_date', { ascending: false });

      if (residentId) {
        query = query.eq('resident_id', residentId);
      }

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      return await query;
    };

    // Try selecting optional columns (requirements_urls + requirements_completed), then gracefully fall back
    // when running against older schemas.
    let cols = [...baseRequestFields, ...optionalRequestFields];
    let data;
    let error;

    for (let attempt = 0; attempt < optionalRequestFields.length + 1; attempt++) {
      ;({ data, error } = await runQuery(cols.join(',')));
      if (!error) break;

      const missing = getMissingAssistanceColumn(error.message);
      if (!missing || !optionalRequestFields.includes(missing)) break;

      cols = cols.filter((c) => c !== missing);
    }

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const enriched = await Promise.all(
      rows.map(async (row) => {
        const reqFromColumn = parsePathArray(row?.requirements_urls);
        const checklist = parseArrayValue(row?.requirements_checklist);
        const maxCount = Array.isArray(checklist) && checklist.length > 0 ? checklist.length : 0;
        const reqFromLegacy = parsePathArray(row?.valid_id_url);
        let requirementUrls = reqFromColumn.length ? reqFromColumn : reqFromLegacy;

        if (!requirementUrls.length && row?.control_number) {
          const fromStorage = await listRequirementPathsFromStorage(row.control_number, maxCount);
          if (fromStorage.length) {
            requirementUrls = fromStorage;
          }
        }

        if (maxCount > 0 && requirementUrls.length > maxCount) {
          requirementUrls = requirementUrls.slice(0, maxCount);
        }

        return {
          ...row,
          requirements_urls: requirementUrls,
        };
      }),
    );

    return NextResponse.json({ data: enriched, error: null });
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

    if (!cooldownInfo.isEligible) {
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
    const validIdUrl =
      legacyValidIdUrl || (allRequirementUrls.length > 1 ? JSON.stringify(allRequirementUrls) : allRequirementUrls?.[0] ?? null);
    const requestSourceRaw = String(body.request_source || body.requestSource || 'online').trim().toLowerCase();
    const requestSource = ALLOWED_REQUEST_SOURCES.has(requestSourceRaw) ? requestSourceRaw : 'online';

    const providedControlNumber = body.control_number || body.controlNumber || null;

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
    const maxRequiredFiles = Array.isArray(requirementsChecklist) ? requirementsChecklist.length : 0;
    const limitedRequirementUrls =
      maxRequiredFiles > 0 ? allRequirementUrls.slice(0, maxRequiredFiles) : allRequirementUrls;
    const limitedRequirementFiles =
      maxRequiredFiles > 0 ? effectiveRequirementFiles.slice(0, maxRequiredFiles) : effectiveRequirementFiles;
    if (requestSource === 'online' && maxRequiredFiles > 0 && limitedRequirementUrls.length < maxRequiredFiles) {
      return NextResponse.json(
        { data: null, error: `Please upload exactly ${maxRequiredFiles} requirement file(s).` },
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

    // If the client didn't provide a control number, generate a sequential one (YYYY-###).
    // Retry on unique conflicts (rare, but can happen with concurrent requests).
    for (let attempt = 0; attempt < 5; attempt++) {
      const controlNumber =
        providedControlNumber || (await generateNextControlNumber(db));

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

        insertPayload = stripped.payload;
        // If older schemas are missing multi-file columns, preserve all file paths in valid_id_url as JSON text.
        if (
          ['requirements_urls', 'requirements_files'].includes(stripped.removed) &&
          allRequirementUrls.length > 1 &&
          typeof insertPayload.valid_id_url === 'string'
        ) {
          insertPayload.valid_id_url = JSON.stringify(allRequirementUrls);
        }
        selectCols = selectCols.filter((c) => c !== stripped.removed);
      }

      if (!error) break;

      const msg = String(error?.message || '').toLowerCase();
      const isDuplicate = msg.includes('duplicate') && msg.includes('control_number');

      if (providedControlNumber || !isDuplicate) {
        break;
      }
    }

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
