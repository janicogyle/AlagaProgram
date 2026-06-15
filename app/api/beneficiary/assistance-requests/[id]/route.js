import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabaseClient';
import { readBeneficiarySession } from '@/lib/beneficiarySession.server';
import { filterCloudinaryUrls, validateCloudinaryDocumentUrls } from '@/lib/documentUrls.server';
import { buildBeneficiaryActor, logActivity } from '@/lib/activityLogger.server';
import { resolveAssistanceAmount } from '@/lib/assistanceAmounts.mjs';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BENEFICIARY_EDITABLE_STATUSES = new Set(['Incomplete', 'Rejected']);
const ALLOWED_ASSISTANCE_TYPES = new Set([
  'Medicine Assistance',
  'Confinement Assistance',
  'Burial Assistance',
]);

const isCheckedRequirement = (row) => {
  const value = row?.checked;
  return value === true || value === 'true' || value === 1 || value === '1';
};

function getResidentIdFromRequest(request, body) {
  const session = readBeneficiarySession(request);
  if (session.ok) return { ok: true, residentId: session.residentId, source: 'cookie' };

  const residentId =
    body?.resident_id ||
    body?.residentId ||
    request.headers.get('x-resident-id') ||
    request.headers.get('x-residentid');

  if (!residentId) return { ok: false, residentId: null, source: 'none' };
  return { ok: true, residentId: String(residentId), source: 'body' };
}

export async function PATCH(request, { params }) {
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

    const idParam = params?.id;
    const bodyKey = body?.control_number || body?.controlNo || body?.request_id || body?.requestId || body?.id;

    const clean = (v) => {
      const s = String(v ?? '').trim();
      if (!s || s === 'undefined' || s === 'null') return null;
      return s;
    };

    // Prefer URL param, but fall back to body control number if client sent /undefined.
    const id = clean(idParam) || clean(bodyKey);
    if (!id) {
      return NextResponse.json({ data: null, error: 'Missing request id.' }, { status: 400 });
    }

    const resident = getResidentIdFromRequest(request, body);
    if (!resident.ok) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized. Please log in again.' },
        { status: 401 },
      );
    }

    const isUuid = UUID_RE.test(id);
    let lookup = db.from('assistance_requests').select('id, resident_id, status, control_number');
    lookup = isUuid ? lookup.eq('id', id) : lookup.eq('control_number', id);

    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;

    if (!existing) {
      return NextResponse.json({ data: null, error: 'Request not found.' }, { status: 404 });
    }

    if (String(existing.resident_id) !== String(resident.residentId)) {
      return NextResponse.json({ data: null, error: 'Forbidden.' }, { status: 403 });
    }

    if (!BENEFICIARY_EDITABLE_STATUSES.has(existing.status)) {
      return NextResponse.json(
        { data: null, error: 'Only incomplete requests can be edited.' },
        { status: 400 },
      );
    }

    const requestedAssistanceTypeRaw = body.assistance_type ?? body.assistanceType;
    const requestedAssistanceType =
      requestedAssistanceTypeRaw === undefined ? undefined : String(requestedAssistanceTypeRaw).trim();
    if (
      requestedAssistanceType !== undefined &&
      !ALLOWED_ASSISTANCE_TYPES.has(requestedAssistanceType)
    ) {
      return NextResponse.json(
        { data: null, error: 'Unsupported assistance type. Choose Medicine, Confinement, or Burial Assistance.' },
        { status: 400 },
      );
    }

    let selfResidentProfile = { id: resident.residentId };
    try {
      const { data: profile } = await db
        .from('residents')
        .select('id, first_name, middle_name, last_name, contact_number, house_no, purok, street, barangay, city')
        .eq('id', resident.residentId)
        .maybeSingle();
      if (profile?.id) selfResidentProfile = profile;
    } catch {
      // Fall back to submitted values if the profile cannot be loaded.
    }
    const selfName = [selfResidentProfile.first_name, selfResidentProfile.middle_name, selfResidentProfile.last_name]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
    const selfAddress = [
      selfResidentProfile.house_no,
      selfResidentProfile.purok,
      selfResidentProfile.street,
      selfResidentProfile.barangay,
      selfResidentProfile.city,
    ]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(', ');

    const parseRequirements = (value) => {
      if (value === undefined) return undefined;
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // ignore
        }
      }
      return [];
    };

    const requirementsUrls = parseRequirements(body.requirements_urls ?? body.requirementsUrls);
    const parseRequirementFiles = (value) => {
      if (value === undefined) return undefined;
      if (!value) return [];
      let list = [];
      if (Array.isArray(value)) {
        list = value;
      } else if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) list = parsed;
        } catch {
          // ignore
        }
      }
      return list
        .map((item) => {
          if (!item || typeof item !== 'object') return null;
          const fileUrl = String(item.file_url || item.fileUrl || '').trim();
          if (!fileUrl) return null;
          return {
            file_url: fileUrl,
            file_name: String(item.file_name || item.fileName || '').trim() || fileUrl.split('/').pop() || 'Document',
            requirement_type: item.requirement_type || item.requirementType || null,
          };
        })
        .filter(Boolean);
    };
    const requirementsFiles = parseRequirementFiles(body.requirements_files ?? body.requirementsFiles);
    const urlsFromFiles = Array.isArray(requirementsFiles) ? requirementsFiles.map((x) => x.file_url).filter(Boolean) : [];
    const allRequirementUrls = (Array.isArray(requirementsUrls) ? requirementsUrls.filter(Boolean) : []).length
      ? requirementsUrls.filter(Boolean)
      : urlsFromFiles;

    const parseChecklist = (value) => {
      if (value === undefined) return undefined;
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(Boolean);
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter(Boolean);
        } catch {
          // ignore
        }
      }
      return [];
    };

    const requirementsChecklist = parseChecklist(body.requirements_checklist ?? body.requirementsChecklist);
    const requirementsCompletedRaw = body.requirements_completed ?? body.requirementsCompleted;
    const legacyRequirementsCompleted =
      requirementsCompletedRaw === true || requirementsCompletedRaw === false ? requirementsCompletedRaw : undefined;
    const requirementsCompleted = requirementsChecklist !== undefined
      ? requirementsChecklist.length > 0 && requirementsChecklist.every(isCheckedRequirement)
      : legacyRequirementsCompleted;
    const requiredLabels = Array.isArray(requirementsChecklist)
      ? requirementsChecklist.map((row) => String(row?.label || '').trim()).filter(Boolean)
      : [];
    const urlsToValidate = [...allRequirementUrls];
    const legacyValidId = body.valid_id_url ?? body.validIdUrl;
    if (legacyValidId && typeof legacyValidId === 'string' && legacyValidId.startsWith('http')) {
      urlsToValidate.push(legacyValidId);
    }
    if (urlsToValidate.length) {
      const docCheck = validateCloudinaryDocumentUrls(urlsToValidate, { label: 'Requirement file' });
      if (!docCheck.ok) {
        return NextResponse.json({ data: null, error: docCheck.error }, { status: 400 });
      }
    }

    const cloudinaryRequirementUrls = filterCloudinaryUrls(allRequirementUrls);
    const limitedRequirementUrls = cloudinaryRequirementUrls;
    const limitedRequirementFiles = (Array.isArray(requirementsFiles) ? requirementsFiles : [])
      .filter((file) => filterCloudinaryUrls([file.file_url]).length > 0);
    const hasRequiredFiles = requiredLabels.length
      ? requiredLabels.every((label, index) => (
          limitedRequirementFiles.some((file) => String(file.requirement_type || '').trim() === label) ||
          !!limitedRequirementUrls[index]
        ))
      : true;
    if (
      (body.request_source ?? body.requestSource ?? 'online') === 'online' &&
      requiredLabels.length > 0 &&
      !hasRequiredFiles
    ) {
      return NextResponse.json(
        { data: null, error: 'Please upload at least one file for each required document.' },
        { status: 400 },
      );
    }

    const allowed = {
      requester_name: selfName || body.requester_name || body.requesterName,
      requester_contact: selfResidentProfile.contact_number || body.requester_contact || body.requesterContact,
      requester_address: selfAddress || body.requester_address || body.requesterAddress,
      beneficiary_name: selfName || body.beneficiary_name || body.beneficiaryName,
      beneficiary_contact: selfResidentProfile.contact_number || body.beneficiary_contact || body.beneficiaryContact,
      beneficiary_address: selfAddress || body.beneficiary_address || body.beneficiaryAddress,
      assistance_type: requestedAssistanceType,
      amount: requestedAssistanceType === undefined
        ? body.amount
        : resolveAssistanceAmount(requestedAssistanceType, body.amount),
      request_date: body.request_date ?? body.requestDate,
      // Legacy column: always keep populated
      valid_id_url:
        body.valid_id_url ??
        body.validIdUrl ??
        (limitedRequirementUrls.length > 1
          ? JSON.stringify(limitedRequirementUrls)
          : limitedRequirementUrls?.[0] ?? null),
      requirements_urls: limitedRequirementUrls,
      requirements_files: limitedRequirementFiles,
      requirements_checklist: requirementsChecklist,
      requirements_completed: requirementsCompleted,
      request_source: 'online',
    };

    const nextStatus = BENEFICIARY_EDITABLE_STATUSES.has(existing.status)
      ? 'Resubmitted'
      : existing.status;
    const update = {
      status: nextStatus,
      processed_by: null,
      decision_remarks: null,
      updated_at: new Date().toISOString(),
    };

    for (const [key, val] of Object.entries(allowed)) {
      if (val !== undefined) update[key] = val;
    }

    const selectFields =
      'id, control_number, resident_id, requester_name, requester_contact, requester_address, beneficiary_name, beneficiary_contact, beneficiary_address, assistance_type, amount, status, request_date, request_source, processed_by, decision_remarks, valid_id_url, requirements_urls, requirements_files, requirements_checklist, requirements_completed, created_at';

    const runUpdate = async (payload) => {
      let updateQuery = db.from('assistance_requests').update(payload);
      updateQuery = isUuid
        ? updateQuery.eq('id', existing.id)
        : updateQuery.eq('control_number', existing.control_number);
      return await updateQuery.select(selectFields).single();
    };

    let { data: updated, error: updateError } = await runUpdate(update);

    if (updateError) {
      const msg = String(updateError?.message || '').toLowerCase();
      if (msg.includes('requirements_') || msg.includes('column "requirements_') || msg.includes('request_source')) {
        // Fallback: Strip requirements columns and retry if the DB schema hasn't been updated yet
        const fallbackUpdate = { ...update };
        delete fallbackUpdate.requirements_urls;
        delete fallbackUpdate.requirements_files;
        delete fallbackUpdate.requirements_checklist;
        delete fallbackUpdate.requirements_completed;
        delete fallbackUpdate.request_source;
        if (limitedRequirementUrls.length > 1 && typeof fallbackUpdate.valid_id_url === 'string') {
          fallbackUpdate.valid_id_url = JSON.stringify(limitedRequirementUrls);
        }

        // Build a select without the requirements columns
        const selectCols = selectFields.split(',').map((s) => s.trim()).filter(Boolean);
        const selectWithoutReq = selectCols
          .filter((c) => !['requirements_urls', 'requirements_files', 'requirements_checklist', 'requirements_completed', 'request_source'].includes(c))
          .join(', ');

        let updateQuery = db.from('assistance_requests').update(fallbackUpdate);
        updateQuery = isUuid
          ? updateQuery.eq('id', existing.id)
          : updateQuery.eq('control_number', existing.control_number);
        const retryResult = await updateQuery.select(selectWithoutReq).single();
        updated = retryResult.data;
        updateError = retryResult.error;
      }
    }


    if (updateError) {
      const msg = String(updateError?.message || '').toLowerCase();
      if (msg.includes('check constraint') || msg.includes('violates') || msg.includes('status')) {
        return NextResponse.json(
          {
            data: null,
            error:
              'Database does not allow the "Resubmitted" status yet. Please run the DB update to add Resubmitted to the assistance_requests.status constraint.',
            code: 'STATUS_CONSTRAINT',
          },
          { status: 409 },
        );
      }
      throw updateError;
    }

    // Best-effort: notify Admin/Staff when an incomplete request moves back under review.
    if (supabaseAdmin && BENEFICIARY_EDITABLE_STATUSES.has(existing.status) && nextStatus === 'Resubmitted') {
      try {
        const { data: recipients } = await supabaseAdmin
          .from('users')
          .select('id, role, status')
          .in('role', ['Admin', 'Staff'])
          .eq('status', 'Active');

        if (recipients?.length) {
          const rows = recipients.map((u) => ({
            user_id: u.id,
            title: 'Assistance request resubmitted',
            message: `Reference: ${existing.control_number}`,
            type: 'info',
            link: '/admin/assistance/requests',
          }));
          await supabaseAdmin.from('notifications').insert(rows);
        }
      } catch (notifyError) {
        console.warn('Unable to create notifications for resubmitted request:', notifyError);
      }
    }

    let residentProfile = { id: resident.residentId };
    try {
      const { data: profile } = await db
        .from('residents')
        .select('id, first_name, middle_name, last_name, contact_number')
        .eq('id', resident.residentId)
        .maybeSingle();
      if (profile?.id) residentProfile = profile;
    } catch {
      // ignore
    }

    await logActivity(
      {
        ...buildBeneficiaryActor(residentProfile),
        action: nextStatus === 'Resubmitted' ? 'Resubmitted assistance request' : 'Updated assistance request',
        message: 'Beneficiary updated an incomplete assistance request.',
        entity_type: 'assistance_request',
        entity_id: updated?.id || existing.id,
        reference_number: updated?.control_number || existing.control_number,
        link: '/beneficiary/history',
        audience_resident_id: resident.residentId,
      },
      supabaseAdmin ?? db,
    );

    return NextResponse.json({ data: updated, error: null, meta: { residentSource: resident.source } });
  } catch (err) {
    console.error('Beneficiary update assistance request error:', err);
    return NextResponse.json(
      { data: null, error: err?.message || 'Failed to update assistance request.' },
      { status: 500 },
    );
  }
}
